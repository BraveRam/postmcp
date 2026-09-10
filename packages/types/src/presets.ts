import type { JSONSchemaObject, MacroStep } from './parser.js';

export type PresetCategory =
  | 'Developer Tools'
  | 'Database & Cloud'
  | 'Payments & Commerce'
  | 'Communication & AI'
  | 'Productivity & Support'
  | 'Social & Media'
  | 'Demo & Testing';

export interface PresetFieldMask {
  path: string;
  fields: string[];
}

export interface PresetMacro {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, JSONSchemaObject>;
    required?: string[];
  };
  steps: MacroStep[];
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  category: PresetCategory;
  authType: string;
  authEnvVar?: string;
  defaultBaseUrl?: string;
  specUrl?: string;
  bundledSpec?: object;
  tags?: string[];
  fieldMasks?: PresetFieldMask[];
  macros?: PresetMacro[];
}

export interface EndpointDef {
  path: string;
  method: 'get' | 'post' | 'put' | 'delete' | 'patch';
  operationId: string;
  summary: string;
  description?: string;
  parameters?: Array<{
    name: string;
    in: 'query' | 'path' | 'header';
    required?: boolean;
    schema: { type: string; format?: string; default?: unknown };
    description?: string;
  }>;
  requestBody?: {
    required?: boolean;
    properties: Record<string, { type: string; description?: string; required?: boolean }>;
  };
  responseSchema?: Record<string, unknown>;
}
