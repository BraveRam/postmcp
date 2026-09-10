export interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
}

export interface DryRunResult {
  isDryRun: true;
  operationId: string;
  method: string;
  targetUrl: string;
  queryParams?: Record<string, unknown>;
  headers: Record<string, string>;
  body?: unknown;
  message: string;
}
