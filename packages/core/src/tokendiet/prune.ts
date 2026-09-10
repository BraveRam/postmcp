/**
 * Recursive structural pruning of nulls, empty values, REST boilerplate noise, and HTML tags.
 */

const BOILERPLATE_KEYS = new Set([
  '_links',
  'links',
  'href',
  '_embedded',
  'etag',
  'telemetry',
  'tracking_id',
  'request_id',
]);

export function stripHtml(str: string): string {
  if (!str || typeof str !== 'string') return str;
  if (!str.includes('<') || !str.includes('>')) return str;
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([!?,.:;])/g, '$1')
    .trim();
}

export function pruneNullsAndNoise<T = unknown>(data: T, maxProseLength: number = 1000): unknown {
  if (data === null || data === undefined) {
    return undefined;
  }

  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (trimmed === '') return undefined;
    const cleanStr = stripHtml(trimmed);
    if (cleanStr.length > maxProseLength) {
      return cleanStr.slice(0, maxProseLength) + '... [PostMCP: field truncated to save tokens]';
    }
    return cleanStr;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    const cleanedArray = data
      .map((item) => pruneNullsAndNoise(item, maxProseLength))
      .filter((item) => item !== undefined);
    return cleanedArray.length > 0 ? cleanedArray : undefined;
  }

  const result: Record<string, unknown> = {};
  let hasValidKeys = false;

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (BOILERPLATE_KEYS.has(key.toLowerCase())) {
      continue; // Skip boilerplate
    }

    const cleanedValue = pruneNullsAndNoise(value, maxProseLength);
    if (cleanedValue !== undefined) {
      result[key] = cleanedValue;
      hasValidKeys = true;
    }
  }

  return hasValidKeys ? result : undefined;
}
