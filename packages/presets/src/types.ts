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
