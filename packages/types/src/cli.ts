import type { AuthConfig } from './http.js';
import type { MacroDefinition } from './parser.js';

export interface PostMcpCliConfig {
  spec?: string;
  baseUrl?: string;
  auth?: AuthConfig;
  jit?: boolean | {
    enabled?: boolean;
    maxMountedTools?: number;
    hotToolKeywords?: string[];
  };
  hotToolKeywords?: string[];
  dryRun?: boolean;
  transport?: 'stdio' | 'http';
  port?: number;
  tokenDiet?: {
    enabled?: boolean;
    maxTokens?: number;
    convertToMarkdownTable?: boolean;
  };
  fieldMasks?: Record<string, string[]>;
  macros?: MacroDefinition[];
  enabledOperations?: Record<string, boolean>;
}

export interface GeneratedProject {
  files: Record<string, string>;
}

export interface RunCommandOptions {
  baseUrl?: string;
  transport?: 'stdio' | 'http';
  port?: string;
  host?: string;
  header?: string[];
  bearer?: string;
  apiKey?: string;
  basicAuth?: string;
  jit?: boolean;
  hotToolKeywords?: string;
  dryRun?: boolean;
  tokenDiet?: boolean;
  maxTokens?: string;
  envFile?: string;
  config?: string;
}

export interface InspectCommandOptions {
  json?: boolean;
}

export interface GenerateCommandOptions {
  lang?: string;
  target?: string;
  out?: string;
}

export type SupportedExportClient = 'cursor' | 'claude' | 'windsurf' | 'opencode' | 'claude-code' | 'codex';

export interface ExportCommandOptions {
  target?: SupportedExportClient | 'all' | string;
  client?: SupportedExportClient | 'all' | string;
  write?: boolean;
  env?: string[];
  bearer?: string;
  baseUrl?: string;
}

export interface StudioCommandOptions {
  port?: string;
  noOpen?: boolean;
}
