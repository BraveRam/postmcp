import type { EndpointDef } from '@postmcp/types';

export type { EndpointDef };

export interface OpenAPIOperation {
  operationId: string;
  summary: string;
  description: string;
  parameters: Array<{
    name: string;
    in: string;
    required: boolean;
    schema: { type: string; format?: string; default?: unknown };
    description?: string;
  }>;
  responses: Record<string, {
    description: string;
    content?: Record<string, { schema: unknown }>;
  }>;
  requestBody?: {
    required: boolean;
    content: Record<string, { schema: { type: string; properties: Record<string, unknown> } }>;
  };
  security?: Array<Record<string, string[]>>;
}

export interface OpenAPISpecDoc {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{ url: string }>;
  paths: Record<string, Record<string, OpenAPIOperation>>;
  components?: {
    securitySchemes: Record<string, {
      type: string;
      scheme?: string;
      in?: string;
      name?: string;
    }>;
  };
}

export function buildOpenAPISpec(opts: {
  title: string;
  version?: string;
  description: string;
  baseUrl: string;
  endpoints: EndpointDef[];
  securityScheme?: {
    name: string;
    type: 'http' | 'apiKey';
    scheme?: string;
    in?: 'header' | 'query';
    headerName?: string;
  };
}): OpenAPISpecDoc {
  const pathsObj: Record<string, Record<string, OpenAPIOperation>> = {};

  for (const ep of opts.endpoints) {
    pathsObj[ep.path] = pathsObj[ep.path] || {};
    const opObj: OpenAPIOperation = {
      operationId: ep.operationId,
      summary: ep.summary,
      description: ep.description || ep.summary,
      parameters: (ep.parameters || []).map((p) => ({
        name: p.name,
        in: p.in,
        required: p.required ?? (p.in === 'path'),
        schema: p.schema,
        description: p.description,
      })),
      responses: {
        '200': {
          description: 'Successful response',
          content: {
            'application/json': {
              schema: ep.responseSchema || { type: 'object' },
            },
          },
        },
      },
    };

    if (ep.requestBody) {
      opObj.requestBody = {
        required: ep.requestBody.required ?? true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: ep.requestBody.properties,
            },
          },
        },
      };
    }

    if (opts.securityScheme) {
      opObj.security = [{ [opts.securityScheme.name]: [] }];
    }

    pathsObj[ep.path][ep.method.toLowerCase()] = opObj;
  }

  const specDoc: OpenAPISpecDoc = {
    openapi: '3.0.3',
    info: {
      title: opts.title,
      version: opts.version || '1.0.0',
      description: opts.description,
    },
    servers: [{ url: opts.baseUrl }],
    paths: pathsObj,
  };

  if (opts.securityScheme) {
    specDoc.components = {
      securitySchemes: {
        [opts.securityScheme.name]:
          opts.securityScheme.type === 'http'
            ? { type: 'http', scheme: opts.securityScheme.scheme || 'bearer' }
            : { type: 'apiKey', in: opts.securityScheme.in || 'header', name: opts.securityScheme.headerName || 'Authorization' },
      },
    };
  }

  return specDoc;
}
