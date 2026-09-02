import { JSONPath } from 'jsonpath-plus';

function setNestedValue(obj: Record<string, any>, pathParts: string[], value: any): void {
  let current = obj;
  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i];
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }
  current[pathParts[pathParts.length - 1]] = value;
}

/**
 * Extracts and filters only the specified fields/JSONPaths from the payload.
 * Preserves nested structure and does not fail open.
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
    } else if (!mask.startsWith('$') && mask.includes('.')) {
      // Nested property path, e.g. "user.profile.name"
      const pathParts = mask.split('.');
      let current = data;
      let found = true;
      for (const part of pathParts) {
        if (current === null || typeof current !== 'object' || current[part] === undefined) {
          found = false;
          break;
        }
        current = current[part];
      }
      if (found && current !== undefined) {
        setNestedValue(result, pathParts, current);
      }
    } else {
      // JSONPath expression starting with $
      try {
        const matches = JSONPath({ path: mask, json: data, wrap: false });
        if (matches !== undefined) {
          const cleanKey = mask.replace(/^\$\.?/, '').replace(/[^a-zA-Z0-9_]/g, '_');
          result[cleanKey] = matches;
        }
      } catch {
        // Ignored if invalid JSONPath
      }
    }
  }

  // Does not fail open: returns filtered object (or empty object if no fields matched)
  return result;
}
