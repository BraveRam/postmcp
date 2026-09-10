import { JSONPath } from 'jsonpath-plus';

export function interpolateString(template: string, context: Record<string, unknown>, uriEncode: boolean = false): string {
  return template.replace(/\{\{([a-zA-Z0-9_$.\[\]]+)\}\}/g, (_, key) => {
    let val: unknown;
    if (context[key] !== undefined) {
      val = context[key];
    } else {
      try {
        const path = key.startsWith('$') ? key : `$.${key}`;
        val = JSONPath({ path, json: context, wrap: false });
      } catch {
        val = '';
      }
    }
    if (val === undefined || val === null) {
      return '';
    }
    const str = String(val);
    return uriEncode ? encodeURIComponent(str) : str;
  });
}

export function interpolateAction(action: string, context: Record<string, unknown>): string {
  const trimmed = action.trim();
  const firstSpaceIdx = trimmed.indexOf(' ');
  let method = 'GET';
  let urlTemplate = trimmed;

  if (firstSpaceIdx !== -1) {
    method = trimmed.substring(0, firstSpaceIdx);
    urlTemplate = trimmed.substring(firstSpaceIdx + 1).trim();
  }

  const qIdx = urlTemplate.indexOf('?');
  const pathPart = qIdx !== -1 ? urlTemplate.substring(0, qIdx) : urlTemplate;
  const queryPart = qIdx !== -1 ? urlTemplate.substring(qIdx + 1) : null;

  const replaceWithEncoding = (str: string): string => {
    return str.replace(/\{\{([a-zA-Z0-9_$.\[\]]+)\}\}/g, (_, key) => {
      let val: unknown;
      if (context[key] !== undefined) {
        val = context[key];
      } else {
        try {
          const path = key.startsWith('$') ? key : `$.${key}`;
          val = JSONPath({ path, json: context, wrap: false });
        } catch {
          val = '';
        }
      }
      if (val === undefined || val === null) {
        return '';
      }
      return encodeURIComponent(String(val));
    });
  };

  const resolvedPath = replaceWithEncoding(pathPart);
  const resolvedQuery = queryPart !== null ? replaceWithEncoding(queryPart) : null;

  const resolvedUrl = resolvedQuery !== null ? `${resolvedPath}?${resolvedQuery}` : resolvedPath;
  return `${method.toUpperCase()} ${resolvedUrl}`;
}

export function interpolateObject<T>(obj: T, context: Record<string, unknown>): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return interpolateString(obj, context, false) as unknown as T;
  if (Array.isArray(obj)) return obj.map((item) => interpolateObject(item, context)) as unknown as T;
  if (typeof obj === 'object') {
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      res[k] = interpolateObject(v, context);
    }
    return res as unknown as T;
  }
  return obj;
}

export function extractExports(response: unknown, exportMap?: Record<string, string>): Record<string, unknown> {
  if (!exportMap || !response) return {};

  const extracted: Record<string, unknown> = {};
  for (const [varName, pathExpr] of Object.entries(exportMap)) {
    try {
      const path = pathExpr.startsWith('$') ? pathExpr : `$.${pathExpr}`;
      const val = JSONPath({ path, json: response, wrap: false });
      if (val !== undefined) {
        extracted[varName] = val;
      }
    } catch {
      // Fallback: direct property read
      if (typeof response === 'object' && response !== null && pathExpr in (response as Record<string, unknown>)) {
        extracted[varName] = (response as Record<string, unknown>)[pathExpr];
      }
    }
  }

  return extracted;
}
