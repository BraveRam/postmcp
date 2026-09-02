import { JSONPath } from 'jsonpath-plus';

export function interpolateString(template: string, context: Record<string, any>, uriEncode: boolean = false): string {
  return template.replace(/\{\{([a-zA-Z0-9_$.\[\]]+)\}\}/g, (_, key) => {
    let val: any;
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

export function interpolateAction(action: string, context: Record<string, any>): string {
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
      let val: any;
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

export function interpolateObject(obj: any, context: Record<string, any>): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return interpolateString(obj, context, false);
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
