import * as fs from 'node:fs';
import * as path from 'node:path';
import dotenv from 'dotenv';
import { AuthConfig } from '@postmcp/core';

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

export function loadEnvFile(envFilePath?: string): void {
  if (envFilePath) {
    const resolved = path.resolve(envFilePath);
    if (fs.existsSync(resolved)) {
      dotenv.config({ path: resolved });
    }
  } else {
    // Default to .env in cwd if exists
    const defaultEnv = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(defaultEnv)) {
      dotenv.config({ path: defaultEnv });
    }
  }
}

export function loadConfigFile(configPath?: string): PostMcpCliConfig {
  let targetPath = configPath ? path.resolve(configPath) : null;

  if (!targetPath) {
    const candidates = ['postmcp.config.json', 'postmcp.json', '.postmcprc.json'];
    for (const c of candidates) {
      const candidatePath = path.resolve(process.cwd(), c);
      if (fs.existsSync(candidatePath)) {
        targetPath = candidatePath;
        break;
      }
    }
  }

  if (targetPath && fs.existsSync(targetPath)) {
    try {
      const content = fs.readFileSync(targetPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  return {};
}

export function parseHeaderFlags(headers?: string[]): Record<string, string> {
  if (!headers || !Array.isArray(headers)) return {};
  const result: Record<string, string> = {};
  for (const h of headers) {
    const colonIdx = h.indexOf(':');
    if (colonIdx !== -1) {
      const key = h.slice(0, colonIdx).trim();
      const val = h.slice(colonIdx + 1).trim();
      if (key && val) {
        result[key] = val;
      }
    }
  }
  return result;
}

export function parseApiKeyFlag(apiKeyStr?: string): { name: string; value: string; in: 'header' | 'query' | 'cookie' } | undefined {
  if (!apiKeyStr) return undefined;
  // Format: "name=value" or "header:name=value" or "query:name=value"
  let location: 'header' | 'query' | 'cookie' = 'header';
  let rest = apiKeyStr;

  if (apiKeyStr.startsWith('query:')) {
    location = 'query';
    rest = apiKeyStr.slice(6);
  } else if (apiKeyStr.startsWith('header:')) {
    location = 'header';
    rest = apiKeyStr.slice(7);
  } else if (apiKeyStr.startsWith('cookie:')) {
    location = 'cookie';
    rest = apiKeyStr.slice(7);
  }

  const eqIdx = rest.indexOf('=');
  if (eqIdx !== -1) {
    const name = rest.slice(0, eqIdx).trim();
    const value = rest.slice(eqIdx + 1).trim();
    if (name && value) {
      return { name, value, in: location };
    }
  }

  return undefined;
}
