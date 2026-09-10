export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options';

export type RiskTier = 'READ_ONLY' | 'MUTATION' | 'CRITICAL';

export interface JSONSchemaObject {
  type?: string | string[];
  title?: string;
  description?: string;
  properties?: Record<string, JSONSchemaObject>;
  required?: string[];
  items?: JSONSchemaObject;
  enum?: unknown[];
  default?: unknown;
  oneOf?: JSONSchemaObject[];
  anyOf?: JSONSchemaObject[];
  allOf?: JSONSchemaObject[];
  $ref?: string;
  additionalProperties?: boolean | JSONSchemaObject;
  format?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: boolean | number;
  exclusiveMaximum?: boolean | number;
  multipleOf?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  minProperties?: number;
  maxProperties?: number;
  nullable?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  example?: unknown;
  examples?: unknown[];
  deprecated?: boolean;
  [key: string]: unknown;
}

export interface NormalizedParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie' | 'body';
  description?: string;
  required: boolean;
  schema: JSONSchemaObject;
  style?: string; // form, spaceDelimited, pipeDelimited, deepObject, simple, matrix
  explode?: boolean;
}

export interface NormalizedOperation {
  id: string;
  method: HttpMethod;
  path: string;
  summary: string;
  description: string;
  tags: string[];
  parameters: NormalizedParameter[];
  inputSchema: JSONSchemaObject;
  responseSchema?: JSONSchemaObject;
  riskTier: RiskTier;
  security?: Array<Record<string, string[]>>;
  isDeprecated?: boolean;
  contentType?: string;
  extensions?: Record<string, unknown>;
}

export interface SecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  description?: string;
  name?: string;
  in?: 'header' | 'query' | 'cookie';
  scheme?: string; // e.g. bearer, basic
  bearerFormat?: string;
}

export interface MacroStep {
  id: string;
  action: string; // e.g. "GET /v1/customers?email={{email}}" or "POST /v1/refunds"
  body?: Record<string, unknown>;
  export?: Record<string, string>; // e.g. { customerId: "data[0].id" }
}

export interface MacroDefinition {
  name: string;
  description: string;
  parameters: JSONSchemaObject;
  steps: MacroStep[];
}

export interface TokenDietConfig {
  enabled: boolean;
  maxTokens?: number;
  pruneNulls?: boolean;
  markdownTables?: boolean;
  fieldMasks?: Record<string, string[]>; // operationId -> field paths
}

export interface NormalizedSpec {
  title: string;
  version: string;
  description?: string;
  servers: Array<{ url: string; description?: string }>;
  operations: NormalizedOperation[];
  securitySchemes: Record<string, SecurityScheme>;
  macros?: MacroDefinition[];
  tokenDiet?: TokenDietConfig;
}
