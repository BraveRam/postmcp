import { BUNDLED_PRESETS, syncAllPresets } from '../presets/index.js';
import { runCommand } from './run.js';
import Table from 'cli-table3';
import pc from 'picocolors';

export async function listPresetsCommand(): Promise<void> {
  console.log();
  console.log(pc.bold(pc.cyan(`⚡ PostMCP Presets Catalog (50+ Curated Developer APIs)`)));
  console.log(pc.dim(`Run any preset instantly using: postmcp run @<preset_id>`));
  console.log();

  const table = new Table({
    head: [pc.bold('Preset ID'), pc.bold('API Name'), pc.bold('Category'), pc.bold('Authentication'), pc.bold('Run Command')],
    colWidths: [14, 24, 20, 26, 26],
  });

  for (const [id, meta] of Object.entries(BUNDLED_PRESETS)) {
    table.push([
      pc.bold(pc.magenta(`@${id}`)),
      meta.name,
      meta.category,
      pc.dim(meta.authType),
      pc.green(`postmcp run @${id}`),
    ]);
  }

  console.log(table.toString());
  console.log();
  console.log(pc.dim(`Run 'postmcp presets sync' to update offline cached schemas from GitHub.`));
  console.log();
}

export async function syncPresetsCommand(): Promise<void> {
  console.log(pc.cyan(`⚡ Syncing latest OpenAPI schemas for all presets...`));
  try {
    const synced = await syncAllPresets();
    console.log(pc.green(`✔ Successfully synced ${synced.length} presets to local cache (~/.postmcp/presets/):`));
    for (const id of synced) {
      console.log(`  ${pc.green('●')} @${id}`);
    }
  } catch (err: any) {
    console.error(pc.red(`Failed to sync presets: ${err.message}`));
  }
}
