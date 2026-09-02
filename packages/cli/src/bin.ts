import { Command } from 'commander';
import { runCommand } from './commands/run.js';
import { inspectCommand } from './commands/inspect.js';
import { generateCommand } from './commands/generate.js';
import { exportCommand } from './commands/export.js';
import { listPresetsCommand, syncPresetsCommand } from './commands/presets.js';
import { studioCommand } from './commands/studio.js';
import pc from 'picocolors';

export function createCli(): Command {
  const program = new Command();

  program
    .name('postmcp')
    .description('The Postman for MCP. Turn any OpenAPI spec into a context-optimized MCP server in seconds.')
    .version('0.1.0');

  // 1. Run Command
  program
    .command('run [spec]')
    .description('Start an MCP server over stdio or Streamable HTTP from an OpenAPI spec')
    .option('-b, --base-url <url>', 'Override target API base URL')
    .option('-t, --transport <type>', 'Transport type: stdio or http (default: stdio)', 'stdio')
    .option('-p, --port <number>', 'Port for Streamable HTTP server')
    .option('-H, --header <key:value...>', 'Custom request headers (can be specified multiple times)', (val, prev: string[] = []) => [...prev, val])
    .option('--bearer <token>', 'Bearer authentication token or $ENV_VAR')
    .option('--api-key <name=value>', 'API key credentials (e.g. key=val, header:key=val, query:key=val)')
    .option('--jit', 'Force Just-In-Time dynamic tool routing')
    .option('--no-jit', 'Disable JIT mode and expose all tools statically')
    .option('--dry-run', 'Simulate mutation & critical requests without real API execution')
    .option('--no-token-diet', 'Disable Token Diet payload pruning & markdown tables')
    .option('--max-tokens <number>', 'Token ceiling per tool response', '2500')
    .option('--env-file <path>', 'Custom .env file path to load')
    .option('-c, --config <path>', 'Custom postmcp.config.json path')
    .action((spec, opts) => {
      runCommand(spec, opts).catch((err) => {
        console.error(pc.red(`Fatal error: ${err.message}`));
        process.exit(1);
      });
    });

  // 2. Inspect Command
  program
    .command('inspect <spec>')
    .description('Inspect an OpenAPI specification: summary, methods breakdown, risk tiers, and JIT recommendation')
    .option('--json', 'Output machine-readable normalized AST JSON')
    .action((spec, opts) => {
      inspectCommand(spec, opts).catch((err) => {
        console.error(pc.red(`Fatal error: ${err.message}`));
        process.exit(1);
      });
    });

  // 3. Generate Command
  program
    .command('generate <spec>')
    .description('Generate a complete standalone TypeScript or Python MCP server project')
    .option('-t, --target <language>', 'Target language: typescript (ts) or python (py)', 'typescript')
    .option('-l, --lang <language>', 'Alias for --target')
    .option('-o, --out <directory>', 'Output directory for the generated project')
    .action((spec, opts) => {
      generateCommand(spec, opts).catch((err) => {
        console.error(pc.red(`Fatal error: ${err.message}`));
        process.exit(1);
      });
    });

  // 4. Export Command
  program
    .command('export <spec>')
    .description('1-Click configuration exporter for Cursor, Claude Desktop, and Windsurf')
    .option('-t, --target <name>', 'Target client: cursor, claude, windsurf, or all (default: all)', 'all')
    .option('--client <name>', 'Alias for --target')
    .option('-w, --write', 'Automatically merge and write configuration directly to the client config file on disk')
    .option('--bearer <token>', 'Bearer token for client configuration environment')
    .option('-b, --base-url <url>', 'Base URL override for client configuration environment')
    .option('-e, --env <key=val...>', 'Environment variables for client configuration', (val, prev: string[] = []) => [...prev, val])
    .action((spec, opts) => {
      const target = opts.target || opts.client || 'all';
      exportCommand(spec, { ...opts, target, client: target }).catch((err) => {
        console.error(pc.red(`Fatal error: ${err.message}`));
        process.exit(1);
      });
    });

  // 5. Presets Command with subcommands & default action
  const presetsCmd = program
    .command('presets')
    .description('Manage and explore bundled top 50+ API presets')
    .argument('[filter]', 'Optional search query or category filter')
    .action((filter) => {
      listPresetsCommand(filter).catch((err) => {
        console.error(pc.red(`Fatal error: ${err.message}`));
        process.exit(1);
      });
    });

  presetsCmd
    .command('list [filter]')
    .description('List all available presets in catalog')
    .action((filter) => {
      listPresetsCommand(filter).catch((err) => {
        console.error(pc.red(`Fatal error: ${err.message}`));
        process.exit(1);
      });
    });

  presetsCmd
    .command('sync')
    .description('Sync latest OpenAPI schemas from GitHub to local cache (~/.postmcp/presets/)')
    .action(() => {
      syncPresetsCommand().catch((err) => {
        console.error(pc.red(`Fatal error: ${err.message}`));
        process.exit(1);
      });
    });

  // 6. Studio Command
  program
    .command('studio [spec]')
    .description('Launch the PostMCP Visual Web Studio')
    .option('-p, --port <port>', 'Studio port', '3000')
    .option('--no-open', 'Do not automatically open browser')
    .action((spec, opts) => {
      studioCommand(spec, opts).catch((err) => {
        console.error(pc.red(`Fatal error: ${err.message}`));
        process.exit(1);
      });
    });

  return program;
}

if (process.env.NODE_ENV !== 'test') {
  const cli = createCli();
  cli.parse(process.argv);
}
