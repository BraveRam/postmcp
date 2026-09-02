import { MacroDefinition } from '../parser/types.js';
import { interpolateString, interpolateObject, extractExports } from './template.js';
import { ResilientHttpClient } from '../http/client.js';

export interface MacroExecutionResult {
  macroName: string;
  success: boolean;
  isDryRun?: boolean;
  stepResults: Array<{
    stepId: string;
    action: string;
    status: number;
    data: any;
  }>;
  finalData: any;
  errorMessage?: string;
}

export async function executeMacro(
  macro: MacroDefinition,
  inputArgs: Record<string, any>,
  httpClient: ResilientHttpClient,
  isDryRun: boolean = false
): Promise<MacroExecutionResult> {
  const context: Record<string, any> = { ...inputArgs };
  const stepResults: MacroExecutionResult['stepResults'] = [];

  for (const step of macro.steps) {
    // Interpolate action string, e.g. "GET /v1/customers?email={{email}}"
    const interpolatedAction = interpolateString(step.action, context);
    const [methodStr, pathWithQuery] = interpolatedAction.trim().split(/\s+/);
    const method = (methodStr || 'GET').toLowerCase();
    const interpolatedBody = step.body ? interpolateObject(step.body, context) : undefined;

    // Dry-run simulation mode (Finding 2)
    if (isDryRun) {
      stepResults.push({
        stepId: step.id,
        action: interpolatedAction,
        status: 200,
        data: {
          simulation: `[DRY-RUN] Would execute ${method.toUpperCase()} ${pathWithQuery}`,
          body: interpolatedBody,
        },
      });
      // In dry-run, mock exported variables so later steps can interpolate
      if (step.export) {
        for (const varName of Object.keys(step.export)) {
          context[varName] = `[mock_${varName}]`;
        }
      }
      continue;
    }

    // Real execution
    const response = await httpClient.request({
      method: method as any,
      url: pathWithQuery,
      data: interpolatedBody,
    });

    stepResults.push({
      stepId: step.id,
      action: interpolatedAction,
      status: response.status,
      data: response.data,
    });

    // Fail-fast on step failure (Finding 13)
    if (response.isError) {
      return {
        macroName: macro.name,
        success: false,
        stepResults,
        finalData: response.data,
        errorMessage: `Macro step '${step.id}' failed with HTTP ${response.status}: ${response.errorMessage || 'Error'}`,
      };
    }

    // Extract exported variables and merge into context
    if (step.export) {
      const exportedVars = extractExports(response.data, step.export);
      Object.assign(context, exportedVars);
    }
  }

  const lastStep = stepResults[stepResults.length - 1];
  return {
    macroName: macro.name,
    success: true,
    isDryRun,
    stepResults,
    finalData: lastStep ? lastStep.data : context,
  };
}
