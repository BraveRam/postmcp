import { JSONPath } from 'jsonpath-plus';

function setByPointer(target: any, pointer: string, value: any): void {
  const parts = pointer
    .replace(/^\//, '')
    .split('/')
    .map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));

  if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) {
    return;
  }

  let current = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];
    const isNextNumeric = /^\d+$/.test(nextPart);

    if (Array.isArray(current)) {
      const idx = parseInt(part, 10);
      if (!current[idx] || typeof current[idx] !== 'object') {
        current[idx] = isNextNumeric ? [] : {};
      }
      current = current[idx];
    } else {
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = isNextNumeric ? [] : {};
      }
      current = current[part];
    }
  }

  const lastPart = parts[parts.length - 1];
  if (Array.isArray(current)) {
    current[parseInt(lastPart, 10)] = value;
  } else {
    current[lastPart] = value;
  }
}

/**
 * Extracts and filters only the specified fields/JSONPaths from the payload.
 * Preserves nested structure and does not fail open.
 */
export function applyFieldMask(data: any, fieldMasks?: string[]): any {
  if (!fieldMasks || fieldMasks.length === 0 || !data || typeof data !== 'object') {
    return data;
  }

  const isArray = Array.isArray(data);
  const target = isArray ? [] : {};
  let hasMatches = false;

  for (const rawMask of fieldMasks) {
    if (!rawMask || typeof rawMask !== 'string') continue;

    let path = rawMask.trim();
    if (!path.startsWith('$')) {
      if (isArray) {
        path = path.startsWith('.') ? `$[*]${path}` : `$[*].${path}`;
      } else {
        path = path.startsWith('.') ? `$${path}` : `$.${path}`;
      }
    }

    try {
      const pointers = JSONPath({ path, json: data, resultType: 'pointer' });
      const values = JSONPath({ path, json: data, resultType: 'value' });

      if (Array.isArray(pointers) && pointers.length > 0) {
        hasMatches = true;
        for (let i = 0; i < pointers.length; i++) {
          setByPointer(target, pointers[i], values[i]);
        }
      }
    } catch {
      // Ignored if invalid JSONPath expression
    }
  }

  return target;
}
