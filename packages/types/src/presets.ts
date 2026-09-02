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
    properties: Record<string, any>;
    required?: string[];
  };
  steps: Array<{
    id: string;
    action: string;
    body?: any;
    export?: Record<string, string>;
  }>;
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
    schema: { type: string; format?: string; default?: any };
    description?: string;
  }>;
  requestBody?: {
    required?: boolean;
    properties: Record<string, { type: string; description?: string; required?: boolean }>;
  };
  responseSchema?: Record<string, any>;
}
