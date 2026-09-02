import { AxiosResponse } from 'axios';

export function parseRetryAfter(headerValue?: string): number | null {
  if (!headerValue) return null;

  // Check if integer seconds
  const seconds = parseInt(headerValue, 10);
  if (!isNaN(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  // Check if HTTP Date
  const date = Date.parse(headerValue);
  if (!isNaN(date)) {
    const diff = date - Date.now();
    return diff > 0 ? diff : 0;
  }

  return null;
}

export async function sleepWithJitter(baseMs: number): Promise<void> {
  const jitter = Math.random() * 200;
  await new Promise((resolve) => setTimeout(resolve, baseMs + jitter));
}
