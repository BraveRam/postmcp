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
 * Normalizes field masks into valid JSONPath expressions.
 * Automatically expands intermediate array properties into wildcard [*] selectors
 * so that masks like 'projects.id' or 'issues.fields.summary' match elements within arrays.
 */
export function normalizeJsonPath(rawMask: string, data: any): string {
  let path = rawMask.trim();
  if (path.startsWith('.')) path = path.slice(1);

  if (Array.isArray(data)) {
    if (path.startsWith('$')) {
      return path;
    }
    const sample = data.find((item) => item && typeof item === 'object') || {};
    const sub = normalizeJsonPath(path, sample);
    return sub.replace(/^\$\.?/, '$[*].');
  }

  if (path.startsWith('$.')) {
    path = path.slice(2);
  } else if (path.startsWith('$')) {
    return path;
  }

  const parts = path.split('.');
  let currentObjs = [data];
  const jsonPathParts = ['$'];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.includes('[')) {
      jsonPathParts.push(part);
      const baseKey = part.split('[')[0];
      const nextObjs: any[] = [];
      for (const obj of currentObjs) {
        if (obj && typeof obj === 'object') {
          const val = obj[baseKey];
          if (Array.isArray(val)) {
            for (const item of val) {
              if (item && typeof item === 'object') nextObjs.push(item);
            }
          } else if (val && typeof val === 'object') {
            nextObjs.push(val);
          }
        }
      }
      currentObjs = nextObjs;
      continue;
    }

    let isArrayProp = false;
    const nextObjs: any[] = [];
    for (const obj of currentObjs) {
      if (obj && typeof obj === 'object') {
        const val = obj[part];
        if (Array.isArray(val)) {
          isArrayProp = true;
          for (const item of val) {
            if (item && typeof item === 'object') nextObjs.push(item);
          }
        } else if (val && typeof val === 'object') {
          nextObjs.push(val);
        }
      }
    }

    if (isArrayProp) {
      jsonPathParts.push(part + '[*]');
    } else {
      jsonPathParts.push(part);
    }
    currentObjs = nextObjs;
  }

  return jsonPathParts.join('.');
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

    const path = normalizeJsonPath(rawMask, data);

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
