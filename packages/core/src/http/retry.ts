export function parseRetryAfter(headerValue?: string, maxCapMs: number = 10000): number | null {
  if (!headerValue) return null;

  // Check if integer seconds
  const seconds = parseInt(headerValue, 10);
  if (!isNaN(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, maxCapMs);
  }

  // Check if HTTP Date
  const date = Date.parse(headerValue);
  if (!isNaN(date)) {
    const diff = date - Date.now();
    return Math.max(0, Math.min(diff, maxCapMs));
  }

  return null;
}

export function isIdempotentMethod(method: string, headers: Record<string, any> = {}): boolean {
  const m = method.toLowerCase();
  if (['get', 'head', 'put', 'delete', 'options'].includes(m)) {
    return true;
  }
  // If POST/PATCH has an idempotency key header, it is safe to retry
  if (headers['idempotency-key'] || headers['x-idempotency-key'] || headers['Idempotency-Key']) {
    return true;
  }
  return false;
}

export async function sleepWithJitter(baseMs: number): Promise<void> {
  const jitter = Math.random() * 200;
  await new Promise((resolve) => setTimeout(resolve, baseMs + jitter));
}
