import { MacroDefinition } from '../parser/types.js';
import { interpolateString, interpolateObject, extractExports } from './template.js';
import { ResilientHttpClient } from '../http/client.js';

export interface MacroExecutionResult {
  macroName: string;
  success: boolean;
  stepResults: Array<{
    stepId: string;
    action: string;
    status: number;
    data: any;
  }>;
  finalData: any;
}

export async function executeMacro(
  macro: MacroDefinition,
  inputArgs: Record<string, any>,
  httpClient: ResilientHttpClient
): Promise<MacroExecutionResult> {
  const context: Record<string, any> = { ...inputArgs };
  const stepResults: MacroExecutionResult['stepResults'] = [];

  for (const step of macro.steps) {
    // Interpolate action string, e.g. "GET /v1/customers?email={{email}}"
    const interpolatedAction = interpolateString(step.action, context);
    const [methodStr, pathWithQuery] = interpolatedAction.trim().split(/\s+/);
    const method = (methodStr || 'GET').toLowerCase();

    const interpolatedBody = step.body ? interpolateObject(step.body, context) : undefined;

    // Execute HTTP step
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
    stepResults,
    finalData: lastStep ? lastStep.data : context,
  };
}
