import type { AuthConfig } from './http.js';

export interface PostMcpCliConfig {
  spec?: string;
  baseUrl?: string;
  auth?: AuthConfig;
  jit?: boolean;
  dryRun?: boolean;
  transport?: 'stdio' | 'http';
  port?: number;
  tokenDiet?: {
    enabled?: boolean;
    maxTokens?: number;
    convertToMarkdownTable?: boolean;
  };
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
  jit?: boolean;
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
  out?: string;
}

export interface ExportCommandOptions {
  target?: 'cursor' | 'claude' | 'windsurf' | 'all';
  client?: 'cursor' | 'claude' | 'windsurf' | 'all';
  write?: boolean;
  env?: string[];
  bearer?: string;
  baseUrl?: string;
}

export interface StudioCommandOptions {
  port?: string;
  noOpen?: boolean;
}
