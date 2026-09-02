import { parseOpenAPI, startStdioServer, startHttpServer, AuthConfig, NormalizedSpec } from '@postmcp/core';
import type { RunCommandOptions } from '@postmcp/types';
import { loadEnvFile, loadConfigFile, parseHeaderFlags, parseApiKeyFlag } from '../config/loader.js';
import { resolvePresetSpec, getPreset, Preset } from '../presets/index.js';
import pc from 'picocolors';

export type { RunCommandOptions };

export async function runCommand(specArg: string, options: RunCommandOptions): Promise<void> {
  // 1. Load environment and configuration files
  loadEnvFile(options.envFile);
  const fileConfig = loadConfigFile(options.config);

  let specPath: string | object | undefined = specArg || fileConfig.spec;
  if (!specPath) {
    console.error(pc.red('Error: No OpenAPI spec provided. Usage: postmcp run <spec-path-or-url-or-@preset>'));
    process.exit(1);
    return;
  }

  let preset: Preset | undefined = undefined;
  if (typeof specPath === 'string' && specPath.startsWith('@')) {
    preset = getPreset(specPath);
    try {
      specPath = await resolvePresetSpec(specPath);
    } catch (err: any) {
      console.error(pc.red(`Error resolving preset: ${err.message}`));
      process.exit(1);
      return;
    }
  }

  // 3. Parse OpenAPI Specification
  let parsedSpec: NormalizedSpec;
  try {
    parsedSpec = await parseOpenAPI(specPath);
  } catch (err: any) {
    console.error(pc.red(`Failed to parse OpenAPI specification: ${err.message}`));
    process.exit(1);
  }

  // If preset defines additional composite macros, wire them into parsed spec
  if (preset && preset.macros && preset.macros.length > 0) {
    parsedSpec.macros = [...(parsedSpec.macros || []), ...preset.macros];
  }

  // 4. Build Auth Configuration with preset authEnvVar fallback
  const cliHeaders = parseHeaderFlags(options.header);
  const cliApiKey = parseApiKeyFlag(options.apiKey);
  const presetAuthSecret = preset?.authEnvVar ? process.env[preset.authEnvVar] : undefined;

  const authConfig: AuthConfig = {
    headers: { ...fileConfig.auth?.headers, ...cliHeaders },
    bearerToken:
      options.bearer ||
      fileConfig.auth?.bearerToken ||
      presetAuthSecret ||
      process.env.API_KEY ||
      process.env.BEARER_TOKEN,
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
    (parsedSpec.servers.length > 0 ? parsedSpec.servers[0].url : preset?.defaultBaseUrl);

  const isJit = options.jit !== undefined ? options.jit : fileConfig.jit !== undefined ? fileConfig.jit : undefined;
  const isDryRun = options.dryRun !== undefined ? options.dryRun : fileConfig.dryRun;
  const isTokenDiet = options.tokenDiet !== undefined ? options.tokenDiet : fileConfig.tokenDiet?.enabled !== false;
  const maxTokens = options.maxTokens ? parseInt(options.maxTokens, 10) : fileConfig.tokenDiet?.maxTokens || 2500;

  // Build path-specific field masks from preset
  const pathFieldMasks: Record<string, string[]> = {};
  if (preset?.fieldMasks) {
    for (const fm of preset.fieldMasks) {
      pathFieldMasks[fm.path] = fm.fields;
    }
  }

  const serverOptions = {
    spec: parsedSpec,
    baseUrl: resolvedBaseUrl,
    auth: authConfig,
    jit: isJit,
    dryRun: isDryRun,
    tokenDiet: {
      enabled: isTokenDiet,
      maxTokens,
      fieldMasks: isTokenDiet ? (Object.keys(pathFieldMasks).length > 0 ? Object.values(pathFieldMasks).flat() : undefined) : undefined,
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
