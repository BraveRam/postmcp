import { parseOpenAPI, startStdioServer, startHttpServer, AuthConfig } from '@postmcp/core';
import { loadEnvFile, loadConfigFile, parseHeaderFlags, parseApiKeyFlag } from '../config/loader.js';
import { resolvePresetSpec } from '../presets/index.js';
import pc from 'picocolors';

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

export async function runCommand(specArg: string, options: RunCommandOptions): Promise<void> {
  // 1. Load environment and configuration files
  loadEnvFile(options.envFile);
  const fileConfig = loadConfigFile(options.config);

  // 2. Resolve spec (handle @preset or path/URL)
  let specPath = specArg || fileConfig.spec;
  if (!specPath) {
    console.error(pc.red('Error: No OpenAPI spec provided. Usage: postmcp run <spec-path-or-url-or-@preset>'));
    process.exit(1);
  }

  if (specPath.startsWith('@')) {
    try {
      specPath = await resolvePresetSpec(specPath);
    } catch (err: any) {
      console.error(pc.red(`Error resolving preset: ${err.message}`));
      process.exit(1);
    }
  }

  // 3. Parse OpenAPI Specification
  let parsedSpec;
  try {
    parsedSpec = await parseOpenAPI(specPath);
  } catch (err: any) {
    console.error(pc.red(`Failed to parse OpenAPI specification: ${err.message}`));
    process.exit(1);
  }

  // 4. Build Auth Configuration
  const cliHeaders = parseHeaderFlags(options.header);
  const cliApiKey = parseApiKeyFlag(options.apiKey);

  const authConfig: AuthConfig = {
    headers: { ...fileConfig.auth?.headers, ...cliHeaders },
    bearerToken: options.bearer || fileConfig.auth?.bearerToken || process.env.API_KEY || process.env.BEARER_TOKEN,
    apiKey: cliApiKey || fileConfig.auth?.apiKey,
    basicAuth: fileConfig.auth?.basicAuth,
    securitySchemes: fileConfig.auth?.securitySchemes,
    allowedExternalHosts: fileConfig.auth?.allowedExternalHosts,
    allowCrossOriginAuth: fileConfig.auth?.allowCrossOriginAuth,
  };

  const transport = options.transport || fileConfig.transport || (options.port ? 'http' : 'stdio');
  const resolvedBaseUrl =
    options.baseUrl ||
    fileConfig.baseUrl ||
    process.env.BASE_URL ||
    (parsedSpec.servers.length > 0 ? parsedSpec.servers[0].url : undefined);

  const isJit = options.jit !== undefined ? options.jit : fileConfig.jit !== undefined ? fileConfig.jit : undefined;
  const isDryRun = options.dryRun !== undefined ? options.dryRun : fileConfig.dryRun;
  const isTokenDiet = options.tokenDiet !== undefined ? options.tokenDiet : fileConfig.tokenDiet?.enabled !== false;
  const maxTokens = options.maxTokens ? parseInt(options.maxTokens, 10) : fileConfig.tokenDiet?.maxTokens || 2500;

  const serverOptions = {
    spec: parsedSpec,
    baseUrl: resolvedBaseUrl,
    auth: authConfig,
    jit: isJit,
    dryRun: isDryRun,
    tokenDiet: {
      enabled: isTokenDiet,
      maxTokens,
      convertToMarkdownTable: fileConfig.tokenDiet?.convertToMarkdownTable !== false,
    },
    serverName: parsedSpec.title,
    serverVersion: parsedSpec.version,
  };

  if (transport === 'http') {
    const port = options.port ? parseInt(options.port, 10) : fileConfig.port || 3000;
    const host = options.host || 'localhost';

    const { url } = await startHttpServer({
      ...serverOptions,
      port,
      host,
    });

    console.log(pc.green(`✔ PostMCP Streamable HTTP server listening at: ${pc.bold(url)}`));
    console.log(pc.dim(`  Service: ${parsedSpec.title} (v${parsedSpec.version}) | Endpoints: ${parsedSpec.operations.length}`));
    if (isDryRun) {
      console.log(pc.yellow(`  Mode: DRY-RUN SIMULATION (Mutations simulated, no real side effects)`));
    }
  } else {
    // Default: stdio transport for Cursor, Claude Desktop, Antigravity
    await startStdioServer(serverOptions);
  }
}
