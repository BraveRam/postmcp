import { JSONPath } from 'jsonpath-plus';

/**
 * Extracts and filters only the specified fields/JSONPaths from the payload.
 */
export function applyFieldMask(data: any, fieldMasks?: string[]): any {
  if (!fieldMasks || fieldMasks.length === 0 || !data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => applyFieldMask(item, fieldMasks));
  }

  const result: Record<string, any> = {};

  for (const mask of fieldMasks) {
    if (!mask.startsWith('$') && !mask.includes('.')) {
      // Simple top-level field
      if (data[mask] !== undefined) {
        result[mask] = data[mask];
      }
    } else {
      // JSONPath expression
      const path = mask.startsWith('$') ? mask : `$.${mask}`;
      try {
        const matches = JSONPath({ path, json: data, wrap: false });
        if (matches !== undefined) {
          const keyName = mask.split('.').pop() || mask;
          result[keyName] = matches;
        }
      } catch {
        // Fallback: direct key check
        if (data[mask] !== undefined) {
          result[mask] = data[mask];
        }
      }
    }
  }

  return Object.keys(result).length > 0 ? result : data;
}
