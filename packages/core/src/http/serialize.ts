import { NormalizedParameter, JSONSchemaObject } from '../parser/types.js';

export interface SerializedRequestParameters {
  path: string;
  queryParams: Record<string, any>;
  headerParams: Record<string, string>;
  cookieParams: Record<string, string>;
}

function validateValueAgainstSchema(
  schema: JSONSchemaObject,
  value: any,
  propPath: string,
  errors: string[]
): void {
  if (value === undefined) {
    return;
  }

  if (value === null) {
    const isNullable =
      schema.nullable === true ||
      schema.type === 'null' ||
      (Array.isArray(schema.type) && schema.type.includes('null'));
    if (!isNullable) {
      errors.push(`Property '${propPath}' cannot be null`);
    }
    return;
  }

  const allowedTypes = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];

  // 1. Enum Check
  if (Array.isArray(schema.enum)) {
    if (!schema.enum.includes(value)) {
      errors.push(
        `Value '${value}' for '${propPath}' is not an allowed enum value (allowed: ${schema.enum.join(', ')})`
      );
    }
  }

  // 2. Type Check (if types specified)
  if (allowedTypes.length > 0 && !allowedTypes.includes('any')) {
    const jsType = typeof value;
    const matchesType = allowedTypes.some((t) => {
      if (t === 'string') return jsType === 'string';
      if (t === 'number') return jsType === 'number' && !isNaN(value);
      if (t === 'integer') return jsType === 'number' && Number.isInteger(value);
      if (t === 'boolean') return jsType === 'boolean';
      if (t === 'array') return Array.isArray(value);
      if (t === 'object') return jsType === 'object' && value !== null && !Array.isArray(value);
      if (t === 'null') return value === null;
      return true;
    });

    if (!matchesType) {
      errors.push(`Invalid type for '${propPath}': expected ${allowedTypes.join(' | ')}, got ${Array.isArray(value) ? 'array' : jsType}`);
      return;
    }
  }

  // 3. String Details & Formats
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`String '${propPath}' must be at least ${schema.minLength} characters`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`String '${propPath}' must be at most ${schema.maxLength} characters`);
    }
    if (schema.pattern) {
      try {
        if (!new RegExp(schema.pattern).test(value)) {
          errors.push(`String '${propPath}' does not match pattern '${schema.pattern}'`);
        }
      } catch {
        // Ignore invalid regex patterns
      }
    }
    if (schema.format) {
      if (schema.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        errors.push(`Invalid email format for '${propPath}': '${value}'`);
      } else if (
        schema.format === 'uuid' &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
      ) {
        errors.push(`Invalid UUID format for '${propPath}': '${value}'`);
      } else if (
        (schema.format === 'uri' || schema.format === 'url') &&
        !/^https?:\/\/[^\s]+$/i.test(value)
      ) {
        errors.push(`Invalid URI format for '${propPath}': '${value}'`);
      } else if (schema.format === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        errors.push(`Invalid date format for '${propPath}' (expected YYYY-MM-DD)`);
      } else if (schema.format === 'date-time' && isNaN(Date.parse(value))) {
        errors.push(`Invalid date-time format for '${propPath}'`);
      } else if (
        schema.format === 'ipv4' &&
        !/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
          value
        )
      ) {
        errors.push(`Invalid IPv4 format for '${propPath}'`);
      } else if (
        schema.format === 'ipv6' &&
        !/^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/.test(
          value
        )
      ) {
        errors.push(`Invalid IPv6 format for '${propPath}'`);
      } else if (
        schema.format === 'hostname' &&
        !/^(?=.{1,253}$)(?:(?!-)[a-zA-Z0-9-]{1,63}(?<!-)\.)*(?!-)[a-zA-Z0-9-]{1,63}(?<!-)$/.test(value)
      ) {
        errors.push(`Invalid hostname format for '${propPath}': '${value}'`);
      } else if (schema.format === 'byte' && !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
        errors.push(`Invalid base64 byte format for '${propPath}'`);
      }
    }
  }

  // 4. Number & Integer Details
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`Number '${propPath}' must be >= ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`Number '${propPath}' must be <= ${schema.maximum}`);
    }
    if (schema.exclusiveMinimum !== undefined) {
      if (typeof schema.exclusiveMinimum === 'number' && value <= schema.exclusiveMinimum) {
        errors.push(`Number '${propPath}' must be > ${schema.exclusiveMinimum}`);
      } else if (schema.exclusiveMinimum === true && schema.minimum !== undefined && value <= schema.minimum) {
        errors.push(`Number '${propPath}' must be > ${schema.minimum}`);
      }
    }
    if (schema.exclusiveMaximum !== undefined) {
      if (typeof schema.exclusiveMaximum === 'number' && value >= schema.exclusiveMaximum) {
        errors.push(`Number '${propPath}' must be < ${schema.exclusiveMaximum}`);
      } else if (schema.exclusiveMaximum === true && schema.maximum !== undefined && value >= schema.maximum) {
        errors.push(`Number '${propPath}' must be < ${schema.maximum}`);
      }
    }
    if (schema.multipleOf !== undefined && schema.multipleOf > 0) {
      const rem = Math.abs(value % schema.multipleOf);
      if (rem > 1e-10 && Math.abs(rem - schema.multipleOf) > 1e-10) {
        errors.push(`Number '${propPath}' must be a multiple of ${schema.multipleOf}`);
      }
    }
  }

  // 5. Array Details
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`Array '${propPath}' must have at least ${schema.minItems} items`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`Array '${propPath}' must have at most ${schema.maxItems} items`);
    }
    if (schema.uniqueItems === true) {
      const serializedItems = value.map((v) => (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)));
      const uniqueSet = new Set(serializedItems);
      if (uniqueSet.size !== value.length) {
        errors.push(`Array '${propPath}' must contain unique items`);
      }
    }
    if (schema.items) {
      for (let i = 0; i < value.length; i++) {
        validateValueAgainstSchema(schema.items as any, value[i], `${propPath}[${i}]`, errors);
      }
    }
  }

  // 6. Object Details
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    if (Array.isArray(schema.required)) {
      for (const req of schema.required) {
        if (value[req] === undefined) {
          errors.push(`Missing required property '${req}' at '${propPath}'`);
        }
      }
    }
    if (schema.minProperties !== undefined && Object.keys(value).length < schema.minProperties) {
      errors.push(`Object '${propPath}' must have at least ${schema.minProperties} properties`);
    }
    if (schema.maxProperties !== undefined && Object.keys(value).length > schema.maxProperties) {
      errors.push(`Object '${propPath}' must have at most ${schema.maxProperties} properties`);
    }
    if (schema.properties) {
      for (const [k, propSchema] of Object.entries(schema.properties)) {
        if (value[k] !== undefined) {
          validateValueAgainstSchema(propSchema as any, value[k], `${propPath}.${k}`, errors);
        }
      }
    }
    if (schema.additionalProperties === false) {
      for (const k of Object.keys(value)) {
        if (!schema.properties || !(k in schema.properties)) {
          errors.push(`Unexpected property '${k}' at '${propPath}' (additionalProperties is false)`);
        }
      }
    } else if (typeof schema.additionalProperties === 'object' && schema.additionalProperties !== null) {
      for (const k of Object.keys(value)) {
        if (!schema.properties || !(k in schema.properties)) {
          validateValueAgainstSchema(
            schema.additionalProperties as any,
            value[k],
            `${propPath}.${k}`,
            errors
          );
        }
      }
    }
  }

  // 7. anyOf / oneOf schema compositions
  if (Array.isArray(schema.anyOf)) {
    const anyMatches = schema.anyOf.some((subSchema) => {
      const subErrors: string[] = [];
      validateValueAgainstSchema(subSchema as any, value, propPath, subErrors);
      return subErrors.length === 0;
    });
    if (!anyMatches) {
      errors.push(`Value for '${propPath}' does not match any of the allowed schemas in anyOf`);
    }
  }

  if (Array.isArray(schema.oneOf)) {
    const matchCount = schema.oneOf.filter((subSchema) => {
      const subErrors: string[] = [];
      validateValueAgainstSchema(subSchema as any, value, propPath, subErrors);
      return subErrors.length === 0;
    }).length;
    if (matchCount !== 1) {
      errors.push(`Value for '${propPath}' must match exactly one schema in oneOf (matched ${matchCount})`);
    }
  }
}

export function validateInputArguments(
  inputSchema: JSONSchemaObject,
  args: Record<string, any>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required parameters
  if (Array.isArray(inputSchema.required)) {
    for (const req of inputSchema.required) {
      if (args[req] === undefined) {
        errors.push(`Missing required parameter: '${req}'`);
      }
    }
  }

  // Validate properties against schema
  if (inputSchema.properties) {
    for (const [key, propSchema] of Object.entries(inputSchema.properties)) {
      if (args[key] !== undefined) {
        validateValueAgainstSchema(propSchema as any, args[key], key, errors);
      }
    }
  }

  // Additional properties check at root level
  if (inputSchema.additionalProperties === false) {
    for (const key of Object.keys(args)) {
      if (!inputSchema.properties || !(key in inputSchema.properties)) {
        errors.push(`Unexpected property '${key}' (additionalProperties is false)`);
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
    let val = args[param.name];
    if (val === undefined || val === null) {
      if (param.schema && (param.schema as any).default !== undefined) {
        val = (param.schema as any).default;
      } else {
        continue;
      }
    }

    if (param.in === 'path') {
      const encoded = encodeURIComponent(String(val));
      path = path.replaceAll(`{${param.name}}`, encoded);
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
