import type { NormalizedSpec } from './parser.js';
import type { AuthConfig } from './http.js';
import type { TokenDietOptions } from './tokendiet.js';

export interface ToolRegistryOptions {
  forceJIT?: boolean;
  maxMountedTools?: number; // LRU capacity (default: 10)
  hotToolKeywords?: string[];
}

export interface PostMcpServerOptions {
  spec: NormalizedSpec;
  baseUrl?: string;
  auth?: AuthConfig;
  tokenDiet?: TokenDietOptions;
  jit?: boolean | ToolRegistryOptions;
  hotToolKeywords?: string[];
  dryRun?: boolean;
  serverName?: string;
  serverVersion?: string;
}

export interface HttpServerOptions extends PostMcpServerOptions {
  port?: number;
  host?: string;
  endpointPath?: string;
}
