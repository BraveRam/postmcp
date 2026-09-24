import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { parseOpenAPI } from '@postmcp/core';
import type { ExportCommandOptions, SupportedExportClient } from '@postmcp/types';
import { resolvePresetSpec } from '../presets/index.js';
import pc from 'picocolors';

export type { ExportCommandOptions, SupportedExportClient };

export interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface McpClientConfigFile {
  $schema?: string;
  mcpServers?: Record<string, McpServerConfig>;
  mcp?: Record<string, unknown>;
  [key: string]: unknown;
}

export function getClientConfigPath(client: SupportedExportClient): string {
  const home = os.homedir();
  if (client === 'cursor') {
    return path.join(process.cwd(), '.cursor', 'mcp.json');
  }
  if (client === 'opencode') {
    return path.join(process.cwd(), 'opencode.json');
  }
  if (client === 'claude-code') {
    return path.join(process.cwd(), '.mcp.json');
  }
  if (client === 'codex') {
    return path.join(process.cwd(), '.codex', 'config.toml');
  }
  if (client === 'claude') {
    if (process.platform === 'darwin') {
      return path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    }
    if (process.platform === 'win32') {
      return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
    }
    // Linux
    return path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
  }
  if (client === 'windsurf') {
    return path.join(home, '.codeium', 'windsurf', 'mcp_config.json');
  }
  return path.join(process.cwd(), 'mcp.json');
}

export function buildClientConfigSnippet(
  serverKey: string,
  specPath: string,
  options: ExportCommandOptions
): McpClientConfigFile {
  const env: Record<string, string> = {};
  if (options.bearer) {
    env['BEARER_TOKEN'] = options.bearer;
    env['API_KEY'] = options.bearer;
  }
  if (options.baseUrl) {
    env['BASE_URL'] = options.baseUrl;
  }
  if (options.env) {
    for (const e of options.env) {
      const eqIdx = e.indexOf('=');
      if (eqIdx !== -1) {
        const k = e.slice(0, eqIdx).trim();
        const v = e.slice(eqIdx + 1).trim();
        if (k) env[k] = v;
      }
    }
  }

  const targetSpecPath =
    specPath.startsWith('http://') || specPath.startsWith('https://') || specPath.startsWith('@')
      ? specPath
      : path.resolve(process.cwd(), specPath);

  return {
    mcpServers: {
      [serverKey]: {
        command: 'npx',
        args: ['-y', '@postmcp/cli', 'run', targetSpecPath],
        env: Object.keys(env).length > 0 ? env : undefined,
      },
    },
  };
}

export function buildOpenCodeConfigSnippet(
  serverKey: string,
  specPath: string,
  options: ExportCommandOptions
): Record<string, unknown> {
  const env: Record<string, string> = {};
  if (options.bearer) {
    env['BEARER_TOKEN'] = options.bearer;
  }
  if (options.baseUrl) {
    env['BASE_URL'] = options.baseUrl;
  }
  if (options.env) {
    for (const e of options.env) {
      const eqIdx = e.indexOf('=');
      if (eqIdx !== -1) {
        const k = e.slice(0, eqIdx).trim();
        const v = e.slice(eqIdx + 1).trim();
        if (k) env[k] = v;
      }
    }
  }

  const targetSpecPath =
    specPath.startsWith('http://') || specPath.startsWith('https://') || specPath.startsWith('@')
      ? specPath
      : path.resolve(process.cwd(), specPath);

  return {
    $schema: 'https://opencode.ai/config.json',
    mcp: {
      [serverKey]: {
        type: 'local',
        enabled: true,
        command: ['npx', '-y', '@postmcp/cli', 'run', targetSpecPath],
        environment: Object.keys(env).length > 0 ? env : undefined,
      },
    },
  };
}

export function buildCodexTomlSnippet(
  serverKey: string,
  specPath: string,
  options: ExportCommandOptions
): string {
  const env: Record<string, string> = {};
  if (options.bearer) {
    env['BEARER_TOKEN'] = options.bearer;
  }
  if (options.baseUrl) {
    env['BASE_URL'] = options.baseUrl;
  }
  if (options.env) {
    for (const e of options.env) {
      const eqIdx = e.indexOf('=');
      if (eqIdx !== -1) {
        const k = e.slice(0, eqIdx).trim();
        const v = e.slice(eqIdx + 1).trim();
        if (k) env[k] = v;
      }
    }
  }

  const targetSpecPath =
    specPath.startsWith('http://') || specPath.startsWith('https://') || specPath.startsWith('@')
      ? specPath
      : path.resolve(process.cwd(), specPath);

  const envEntries = Object.entries(env)
    .map(([k, v]) => `${k} = "${v}"`)
    .join(', ');
  const envLine = envEntries.length > 0 ? `\nenv = { ${envEntries} }` : '';

  return `[mcp_servers.${serverKey}]
command = "npx"
args = ["-y", "@postmcp/cli", "run", "${targetSpecPath}", "--no-jit"]${envLine}`;
}

const ALL_CLIENTS: SupportedExportClient[] = ['cursor', 'opencode', 'claude-code', 'codex', 'claude', 'windsurf'];

export interface WriteConfigResult {
  success: boolean;
  configPath: string;
  backupPath?: string;
  action: 'appended' | 'merged' | 'skipped';
  message: string;
}

export function writeClientConfig(
  client: SupportedExportClient,
  serverKey: string,
  specPath: string,
  options: ExportCommandOptions,
  customConfigPath?: string
): WriteConfigResult {
  const configPath = customConfigPath || getClientConfigPath(client);
  const parentDir = path.dirname(configPath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  if (client === 'codex') {
    const formattedSnippet = buildCodexTomlSnippet(serverKey, specPath, options);
    let content = '';
    if (fs.existsSync(configPath)) {
      content = fs.readFileSync(configPath, 'utf-8');
    }
    if (!content.includes(`[mcp_servers.${serverKey}]`)) {
      content = content ? `${content.trim()}\n\n${formattedSnippet}\n` : `${formattedSnippet}\n`;
      fs.writeFileSync(configPath, content, 'utf-8');
      return {
        success: true,
        configPath,
        action: 'appended',
        message: `Successfully appended to ${configPath}`,
      };
    } else {
      return {
        success: true,
        configPath,
        action: 'skipped',
        message: `Server [mcp_servers.${serverKey}] already exists in ${configPath}`,
      };
    }
  }

  let existingConfig: McpClientConfigFile = {};
  let backupPath: string | undefined = undefined;

  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf-8');
    if (raw.trim().length > 0) {
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('Root configuration must be a JSON object');
        }
        existingConfig = parsed as McpClientConfigFile;
      } catch (parseErr: unknown) {
        if (!options.force) {
          const parseMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
          throw new Error(
            `Existing config file at ${configPath} contains invalid JSON (${parseMsg}). ` +
            `Aborting to prevent losing existing servers. Fix the syntax error or pass '--force' to overwrite.`
          );
        }
        backupPath = `${configPath}.bak`;
        fs.copyFileSync(configPath, backupPath);
        existingConfig = {};
      }
    }
  }

  if (client === 'opencode') {
    existingConfig.$schema = existingConfig.$schema || 'https://opencode.ai/config.json';
    existingConfig.mcp = (existingConfig.mcp as Record<string, unknown>) || {};
    const openCodeSnippet = buildOpenCodeConfigSnippet(serverKey, specPath, options);
    const newMcp = (openCodeSnippet.mcp as Record<string, unknown>)?.[serverKey];
    if (newMcp) {
      (existingConfig.mcp as Record<string, unknown>)[serverKey] = newMcp;
    }
    fs.writeFileSync(configPath, JSON.stringify(existingConfig, null, 2), 'utf-8');
  } else {
    existingConfig.mcpServers = existingConfig.mcpServers || {};
    const snippet = buildClientConfigSnippet(serverKey, specPath, options);
    if (snippet.mcpServers?.[serverKey]) {
      existingConfig.mcpServers[serverKey] = snippet.mcpServers[serverKey];
    }
    fs.writeFileSync(configPath, JSON.stringify(existingConfig, null, 2), 'utf-8');
  }

  return {
    success: true,
    configPath,
    backupPath,
    action: 'merged',
    message: `Successfully merged and written to ${configPath}`,
  };
}

export async function exportCommand(specArg: string, options: ExportCommandOptions): Promise<void> {
  let specPath = specArg;
  if (!specPath) {
    console.error(pc.red('Error: No OpenAPI spec provided. Usage: postmcp export <spec-path-or-url-or-@preset> --target cursor|opencode|claude-code|codex|claude|windsurf|all'));
    process.exit(1);
  }

  let serverKey = 'api-server';
  if (specPath.startsWith('@')) {
    serverKey = specPath.replace(/^@/, '').toLowerCase();
  } else {
    try {
      const parsed = await parseOpenAPI(specPath, undefined, {
        refresh: options.refresh,
        noCache: options.cache === false,
      });
      serverKey = parsed.title.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'api-server';
    } catch {
      serverKey = 'api-server';
    }
  }

  const selectedTarget = (options.client || options.target || 'all').toLowerCase();
  const clientsToExport: SupportedExportClient[] =
    selectedTarget === 'all'
      ? ALL_CLIENTS
      : [selectedTarget as SupportedExportClient];

  console.log(pc.bold(pc.cyan(`PostMCP 1-Click Client Configuration Exporter`)));
  console.log();

  for (const c of clientsToExport) {
    const configPath = getClientConfigPath(c);
    let formattedSnippet = '';

    if (c === 'opencode') {
      const snippet = buildOpenCodeConfigSnippet(serverKey, specPath, options);
      formattedSnippet = JSON.stringify(snippet, null, 2);
    } else if (c === 'codex') {
      formattedSnippet = buildCodexTomlSnippet(serverKey, specPath, options);
    } else {
      const snippet = buildClientConfigSnippet(serverKey, specPath, options);
      formattedSnippet = JSON.stringify(snippet, null, 2);
    }

    const isProjectLocal = ['cursor', 'opencode', 'claude-code', 'codex'].includes(c);
    console.log(pc.bold(pc.green(`▶ ${c.toUpperCase()} (${isProjectLocal ? 'Project Local' : 'Global Client'})`)));
    console.log(pc.dim(`  Config path: ${configPath}`));
    console.log();
    console.log(pc.gray(formattedSnippet));
    console.log();

    if (options.write) {
      try {
        const result = writeClientConfig(c, serverKey, specPath, options, configPath);
        if (result.backupPath) {
          console.log(pc.yellow(`  Warning: Existing malformed config backed up to ${result.backupPath}`));
        }
        if (result.action === 'skipped') {
          console.log(pc.yellow(`  ${result.message}`));
        } else {
          console.log(pc.green(`  ${result.message}`));
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(pc.red(`  Failed to write to ${configPath}: ${errMsg}`));
      }
      console.log();
    }
  }

  if (!options.write) {
    console.log(pc.dim(`Tip: Pass '--write' to automatically install this configuration into your client settings.`));
  }
}
