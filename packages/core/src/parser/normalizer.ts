import {
  NormalizedSpec,
  NormalizedOperation,
  NormalizedParameter,
  JSONSchemaObject,
  HttpMethod,
  RiskTier,
  SecurityScheme,
} from './types.js';

function cleanOperationId(method: HttpMethod, path: string, rawId?: string): string {
  if (rawId && rawId.trim()) {
    // Sanitize existing operationId
    const cleaned = rawId
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    if (cleaned) {
      if (cleaned.includes('_')) {
        return cleaned
          .split('_')
          .map((part, index) => (index === 0 ? part.charAt(0).toLowerCase() + part.slice(1) : part.charAt(0).toUpperCase() + part.slice(1)))
          .join('');
      }
      return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
    }
  }

  // Fallback: generate from method and path
  const pathParts = path
    .split('/')
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith('{') && part.endsWith('}')) {
        return 'By' + part.slice(1, -1).charAt(0).toUpperCase() + part.slice(2);
      }
      return part.charAt(0).toUpperCase() + part.slice(1);
    });

  return method.toLowerCase() + pathParts.join('');
}

function classifyRiskTier(method: HttpMethod, path: string, summary: string): RiskTier {
  if (method === 'get' || method === 'head' || method === 'options') {
    return 'READ_ONLY';
  }

  const destructiveRegex = /(delete|drop|purge|cancel|terminate|refund|transfer|destroy|wipe|revoke|admin)/i;
  if (method === 'delete' || destructiveRegex.test(path) || destructiveRegex.test(summary)) {
    return 'CRITICAL';
  }

  return 'MUTATION';
}

function buildUnifiedInputSchema(
  parameters: NormalizedParameter[],
  requestBodySchema?: JSONSchemaObject
): JSONSchemaObject {
  const properties: Record<string, JSONSchemaObject> = {};
  const required: string[] = [];

  // Add path/query/header parameters
  for (const param of parameters) {
    properties[param.name] = {
      ...param.schema,
      description: param.description || param.schema.description,
    };
    if (param.required) {
      required.push(param.name);
    }
  }

  // Merge requestBody properties if JSON
  if (requestBodySchema) {
    if (requestBodySchema.type === 'object' && requestBodySchema.properties) {
      for (const [propKey, propSchema] of Object.entries(requestBodySchema.properties)) {
        properties[propKey] = propSchema;
      }
      if (Array.isArray(requestBodySchema.required)) {
        for (const req of requestBodySchema.required) {
          if (!required.includes(req)) {
            required.push(req);
          }
        }
      }
    } else {
      // Primitive or array body
      properties['requestBody'] = requestBodySchema;
      required.push('requestBody');
    }
  }

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
    additionalProperties: false,
  };
}

export function normalizeSpec(spec: any): NormalizedSpec {
  const isSwagger2 = spec.swagger === '2.0';
  const isOAS3 = typeof spec.openapi === 'string' && spec.openapi.startsWith('3.');

  const title = spec.info?.title || 'OpenAPI Service';
  const version = spec.info?.version || '1.0.0';
  const description = spec.info?.description || '';

  // Extract Servers
  const servers: Array<{ url: string; description?: string }> = [];
  if (isOAS3 && Array.isArray(spec.servers) && spec.servers.length > 0) {
    for (const server of spec.servers) {
      if (server.url) {
        servers.push({ url: server.url, description: server.description });
      }
    }
  } else if (isSwagger2) {
    const host = spec.host || 'localhost';
    const basePath = spec.basePath || '';
    const schemes = Array.isArray(spec.schemes) && spec.schemes.length > 0 ? spec.schemes : ['https'];
    for (const scheme of schemes) {
      servers.push({ url: `${scheme}://${host}${basePath}`, description: `${scheme.toUpperCase()} Server` });
    }
  }

  if (servers.length === 0) {
    servers.push({ url: '/', description: 'Default Server' });
  }

  // Extract Security Schemes
  const securitySchemes: Record<string, SecurityScheme> = {};
  if (isOAS3 && spec.components?.securitySchemes) {
    for (const [key, sec] of Object.entries<any>(spec.components.securitySchemes)) {
      securitySchemes[key] = {
        type: sec.type,
        description: sec.description,
        name: sec.name,
        in: sec.in,
        scheme: sec.scheme,
        bearerFormat: sec.bearerFormat,
      };
    }
  } else if (isSwagger2 && spec.securityDefinitions) {
    for (const [key, sec] of Object.entries<any>(spec.securityDefinitions)) {
      securitySchemes[key] = {
        type: sec.type === 'basic' ? 'http' : sec.type,
        scheme: sec.type === 'basic' ? 'basic' : undefined,
        description: sec.description,
        name: sec.name,
        in: sec.in,
      };
    }
  }

  // Extract Operations
  const operations: NormalizedOperation[] = [];
  const paths = spec.paths || {};
  const usedOperationIds = new Set<string>();

  const httpMethods: HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

  for (const [pathKey, pathItem] of Object.entries<any>(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;

    const commonParams = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];

    for (const method of httpMethods) {
      const op = pathItem[method];
      if (!op || typeof op !== 'object') continue;

      let opId = cleanOperationId(method, pathKey, op.operationId);
      // Ensure uniqueness
      let uniqueId = opId;
      let counter = 1;
      while (usedOperationIds.has(uniqueId)) {
        uniqueId = `${opId}_${counter++}`;
      }
      usedOperationIds.add(uniqueId);

      const summary = op.summary || `${method.toUpperCase()} ${pathKey}`;
      const desc = op.description || summary;
      const tags = Array.isArray(op.tags) ? op.tags : ['default'];
      const riskTier = classifyRiskTier(method, pathKey, summary + ' ' + desc);

      // Collect parameters
      const mergedParams = [...commonParams, ...(Array.isArray(op.parameters) ? op.parameters : [])];
      const normalizedParams: NormalizedParameter[] = [];

      let requestBodySchema: JSONSchemaObject | undefined;
      let contentType = 'application/json';

      for (const param of mergedParams) {
        if (!param || !param.name) continue;

        if (param.in === 'body') {
          // Swagger 2.0 body param
          requestBodySchema = param.schema || { type: 'object' };
        } else {
          normalizedParams.push({
            name: param.name,
            in: param.in,
            description: param.description,
            required: Boolean(param.required),
            schema: param.schema || {
              type: param.type || 'string',
              format: param.format,
              enum: param.enum,
              default: param.default,
            },
            style: param.style,
            explode: param.explode,
          });
        }
      }

      // OpenAPI 3.x requestBody
      if (op.requestBody?.content) {
        const jsonContent =
          op.requestBody.content['application/json'] ||
          op.requestBody.content['application/x-www-form-urlencoded'] ||
          op.requestBody.content['multipart/form-data'];

        if (jsonContent?.schema) {
          requestBodySchema = jsonContent.schema;
        }

        if (op.requestBody.content['application/x-www-form-urlencoded']) {
          contentType = 'application/x-www-form-urlencoded';
        } else if (op.requestBody.content['multipart/form-data']) {
          contentType = 'multipart/form-data';
        }
      }

      const inputSchema = buildUnifiedInputSchema(normalizedParams, requestBodySchema);

      // Extract 200/201 response schema if available
      const successResponse = op.responses?.['200'] || op.responses?.['201'] || op.responses?.['default'];
      const responseSchema =
        successResponse?.content?.['application/json']?.schema || successResponse?.schema;

      operations.push({
        id: uniqueId,
        method,
        path: pathKey,
        summary,
        description: desc,
        tags,
        parameters: normalizedParams,
        inputSchema,
        responseSchema,
        riskTier,
        security: op.security || spec.security,
        isDeprecated: Boolean(op.deprecated),
        contentType,
      });
    }
  }

  return {
    title,
    version,
    description,
    servers,
    operations,
    securitySchemes,
  };
}
