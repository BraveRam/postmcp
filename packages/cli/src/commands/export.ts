import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { parseOpenAPI } from '@postmcp/core';
import { resolvePresetSpec } from '../presets/index.js';
import pc from 'picocolors';

export interface ExportCommandOptions {
  client?: 'cursor' | 'claude' | 'windsurf' | 'all';
  write?: boolean;
  env?: string[];
  bearer?: string;
  baseUrl?: string;
}

export function getClientConfigPath(client: 'cursor' | 'claude' | 'windsurf'): string {
  const home = os.homedir();
  if (client === 'cursor') {
    return path.join(process.cwd(), '.cursor', 'mcp.json');
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
): object {
  const env: Record<string, string> = {};
  if (options.bearer) {
    env['API_KEY'] = options.bearer;
  }
  if (options.baseUrl) {
    env['BASE_URL'] = options.baseUrl;
  }
  if (options.env) {
    for (const e of options.env) {
      const [k, v] = e.split('=');
      if (k && v) env[k] = v;
    }
  }

  return {
    mcpServers: {
      [serverKey]: {
        command: 'npx',
        args: ['-y', 'postmcp', 'run', specPath],
        env: Object.keys(env).length > 0 ? env : undefined,
      },
    },
  };
}

export async function exportCommand(specArg: string, options: ExportCommandOptions): Promise<void> {
  let specPath = specArg;
  if (!specPath) {
    console.error(pc.red('Error: No OpenAPI spec provided. Usage: postmcp export <spec-path-or-url-or-@preset>'));
    process.exit(1);
  }

  let serverKey = 'api-server';
  if (specPath.startsWith('@')) {
    serverKey = specPath.replace(/^@/, '').toLowerCase();
  } else {
    try {
      const parsed = await parseOpenAPI(specPath);
      serverKey = parsed.title.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'api-server';
    } catch {
      serverKey = 'api-server';
    }
  }

  const client = options.client || 'all';
  const clientsToExport: Array<'cursor' | 'claude' | 'windsurf'> =
    client === 'all' ? ['cursor', 'claude', 'windsurf'] : [client];

  console.log(pc.bold(pc.cyan(`⚡ PostMCP 1-Click Client Configuration Exporter`)));
  console.log();

  for (const c of clientsToExport) {
    const configPath = getClientConfigPath(c);
    const snippet = buildClientConfigSnippet(serverKey, specPath, options);
    const formattedSnippet = JSON.stringify(snippet, null, 2);

    console.log(pc.bold(pc.green(`▶ ${c.toUpperCase()} (${c === 'cursor' ? 'Project Local' : 'Global Client'})`)));
    console.log(pc.dim(`  Config path: ${configPath}`));
    console.log();
    console.log(pc.gray(formattedSnippet));
    console.log();

    if (options.write) {
      try {
        let existingConfig: any = {};
        if (fs.existsSync(configPath)) {
          const raw = fs.readFileSync(configPath, 'utf-8');
          existingConfig = JSON.parse(raw);
        }

        existingConfig.mcpServers = existingConfig.mcpServers || {};
        existingConfig.mcpServers[serverKey] = (snippet as any).mcpServers[serverKey];

        const parentDir = path.dirname(configPath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }

        fs.writeFileSync(configPath, JSON.stringify(existingConfig, null, 2), 'utf-8');
        console.log(pc.green(`  ✔ Successfully merged and written to ${configPath}`));
      } catch (err: any) {
        console.error(pc.red(`  ✖ Failed to write to ${configPath}: ${err.message}`));
      }
      console.log();
    }
  }

  if (!options.write) {
    console.log(pc.dim(`Tip: Pass '--write' to automatically install this configuration into your client settings.`));
  }
}
