import { NormalizedParameter, JSONSchemaObject } from '../parser/types.js';

export interface SerializedRequestParameters {
  path: string;
  queryParams: Record<string, any>;
  headerParams: Record<string, string>;
  cookieParams: Record<string, string>;
}

export function validateInputArguments(
  inputSchema: JSONSchemaObject,
  args: Record<string, any>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required parameters
  if (Array.isArray(inputSchema.required)) {
    for (const req of inputSchema.required) {
      if (args[req] === undefined || args[req] === null || args[req] === '') {
        errors.push(`Missing required parameter: '${req}'`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function serializeParameters(
  rawPath: string,
  parameters: NormalizedParameter[],
  args: Record<string, any>
): SerializedRequestParameters {
  let path = rawPath;
  const queryParams: Record<string, any> = {};
  const headerParams: Record<string, string> = {};
  const cookieParams: Record<string, string> = {};

  for (const param of parameters) {
    const val = args[param.name];
    if (val === undefined || val === null) continue;

    if (param.in === 'path') {
      const encoded = encodeURIComponent(String(val));
      path = path.replace(`{${param.name}}`, encoded);
    } else if (param.in === 'query') {
      const style = param.style || 'form';
      const explode = param.explode !== undefined ? param.explode : style === 'form';

      if (style === 'deepObject' && typeof val === 'object' && !Array.isArray(val)) {
        // deepObject: filter[status]=active
        for (const [k, v] of Object.entries(val)) {
          queryParams[`${param.name}[${k}]`] = v;
        }
      } else if (Array.isArray(val)) {
        if (style === 'pipeDelimited') {
          queryParams[param.name] = val.join('|');
        } else if (style === 'spaceDelimited') {
          queryParams[param.name] = val.join(' ');
        } else if (style === 'form' && !explode) {
          queryParams[param.name] = val.join(',');
        } else {
          // form with explode: true (or standard array)
          queryParams[param.name] = val;
        }
      } else {
        queryParams[param.name] = val;
      }
    } else if (param.in === 'header') {
      headerParams[param.name] = String(val);
    } else if (param.in === 'cookie') {
      cookieParams[param.name] = String(val);
    }
  }

  // Verify all path placeholders were resolved
  const unreplacedPlaceholders = path.match(/\{[a-zA-Z0-9_]+\}/g);
  if (unreplacedPlaceholders) {
    throw new Error(`Unresolved path parameters in URL '${path}': ${unreplacedPlaceholders.join(', ')}`);
  }

  return {
    path,
    queryParams,
    headerParams,
    cookieParams,
  };
}
