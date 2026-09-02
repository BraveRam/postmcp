import { JSONPath } from 'jsonpath-plus';

export function interpolateString(template: string, context: Record<string, any>): string {
  return template.replace(/\{\{([a-zA-Z0-9_$.\[\]]+)\}\}/g, (_, key) => {
    if (context[key] !== undefined) {
      return String(context[key]);
    }
    // Try JSONPath
    try {
      const path = key.startsWith('$') ? key : `$.${key}`;
      const val = JSONPath({ path, json: context, wrap: false });
      return val !== undefined ? String(val) : '';
    } catch {
      return '';
    }
  });
}

export function interpolateObject(obj: any, context: Record<string, any>): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return interpolateString(obj, context);
  if (Array.isArray(obj)) return obj.map((item) => interpolateObject(item, context));
  if (typeof obj === 'object') {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      res[k] = interpolateObject(v, context);
    }
    return res;
  }
  return obj;
}

export function extractExports(response: any, exportMap?: Record<string, string>): Record<string, any> {
  if (!exportMap || !response) return {};

  const extracted: Record<string, any> = {};
  for (const [varName, pathExpr] of Object.entries(exportMap)) {
    try {
      const path = pathExpr.startsWith('$') ? pathExpr : `$.${pathExpr}`;
      const val = JSONPath({ path, json: response, wrap: false });
      if (val !== undefined) {
        extracted[varName] = val;
      }
    } catch {
      // Fallback: direct property read
      if (response[pathExpr] !== undefined) {
        extracted[varName] = response[pathExpr];
      }
    }
  }

  return extracted;
}
