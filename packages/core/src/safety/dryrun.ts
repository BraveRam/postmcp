import { NormalizedOperation } from '../parser/types.js';

export interface DryRunResult {
  isDryRun: true;
  operationId: string;
  method: string;
  targetUrl: string;
  headers: Record<string, string>;
  body?: any;
  message: string;
}

export function simulateExecution(
  op: NormalizedOperation,
  targetUrl: string,
  headers: Record<string, string>,
  body?: any
): DryRunResult {
  return {
    isDryRun: true,
    operationId: op.id,
    method: op.method.toUpperCase(),
    targetUrl,
    headers: { ...headers, Authorization: headers.Authorization ? '[REDACTED]' : undefined as any },
    body,
    message: `[DRY-RUN SIMULATION] Planned ${op.method.toUpperCase()} request to ${targetUrl}. No real mutation was executed.`,
  };
}
