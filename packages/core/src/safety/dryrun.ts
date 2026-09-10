import { NormalizedOperation } from '../parser/types.js';

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

const SENSITIVE_HEADER_REGEX = /^(authorization|x-api-key|api-key|cookie|token|secret|password|key|auth)/i;
const SENSITIVE_BODY_KEY_REGEX = /(password|secret|token|api[_-]?key|credit[_-]?card|cvv)/i;

function redactSensitiveData<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(redactSensitiveData) as unknown as T;

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_BODY_KEY_REGEX.test(k)) {
      result[k] = '[REDACTED]';
    } else {
      result[k] = redactSensitiveData(v);
    }
  }
  return result as unknown as T;
}

export function simulateExecution(
  op: NormalizedOperation,
  fullTargetUrl: string,
  headers: Record<string, string>,
  queryParams?: Record<string, unknown>,
  body?: unknown
): DryRunResult {
  const sanitizedHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (SENSITIVE_HEADER_REGEX.test(k)) {
      sanitizedHeaders[k] = '[REDACTED]';
    } else {
      sanitizedHeaders[k] = v;
    }
  }

  const sanitizedBody = redactSensitiveData(body);
  const sanitizedQuery = redactSensitiveData(queryParams);

  return {
    isDryRun: true,
    operationId: op.id,
    method: op.method.toUpperCase(),
    targetUrl: fullTargetUrl,
    queryParams: sanitizedQuery && Object.keys(sanitizedQuery).length > 0 ? sanitizedQuery : undefined,
    headers: sanitizedHeaders,
    body: sanitizedBody,
    message: `[DRY-RUN SIMULATION] Planned ${op.method.toUpperCase()} request to ${fullTargetUrl}. No real mutation was executed.`,
  };
}
