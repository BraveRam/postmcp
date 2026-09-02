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
  queryParams?: Record<string, any>;
  headers: Record<string, string>;
  body?: any;
  message: string;
}
