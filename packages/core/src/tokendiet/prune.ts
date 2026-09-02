/**
 * Recursive structural pruning of nulls, empty values, and REST boilerplate noise.
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

export function pruneNullsAndNoise(data: any): any {
  if (data === null || data === undefined) {
    return undefined;
  }

  if (typeof data === 'string') {
    return data.trim() === '' ? undefined : data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    const cleanedArray = data
      .map(pruneNullsAndNoise)
      .filter((item) => item !== undefined);
    return cleanedArray.length > 0 ? cleanedArray : undefined;
  }

  const result: Record<string, any> = {};
  let hasValidKeys = false;

  for (const [key, value] of Object.entries(data)) {
    if (BOILERPLATE_KEYS.has(key.toLowerCase())) {
      continue; // Skip boilerplate
    }

    const cleanedValue = pruneNullsAndNoise(value);
    if (cleanedValue !== undefined) {
      result[key] = cleanedValue;
      hasValidKeys = true;
    }
  }

  return hasValidKeys ? result : undefined;
}
