import { ALL_PRESETS, syncAllPresets } from '../presets/index.js';
import Table from 'cli-table3';
import pc from 'picocolors';

export async function listPresetsCommand(categoryOrQuery?: string): Promise<void> {
  console.log();
  console.log(pc.bold(pc.cyan(`PostMCP Presets Catalog (${ALL_PRESETS.length} Curated Developer APIs)`)));
  console.log(pc.dim(`Run any preset instantly using: postmcp run @<preset_id>`));
  console.log();

  let displayedPresets = ALL_PRESETS;
  if (categoryOrQuery) {
    const q = categoryOrQuery.toLowerCase().trim();
    displayedPresets = ALL_PRESETS.filter((p: any) => {
      return (
        p.id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.tags && p.tags.some((t: string) => t.toLowerCase().includes(q)))
      );
    });
  }

  const table = new Table({
    head: [pc.bold('Preset ID'), pc.bold('API Name'), pc.bold('Category'), pc.bold('Authentication'), pc.bold('Run Command')],
    colWidths: [14, 26, 22, 28, 26],
  });

  for (const meta of displayedPresets) {
    table.push([
      pc.bold(pc.magenta(`@${meta.id}`)),
      meta.name,
      meta.category,
      pc.dim(meta.authType),
      pc.green(`postmcp run @${meta.id}`),
    ]);
  }

  console.log(table.toString());
  console.log();
  console.log(pc.dim(`Total Presets: ${displayedPresets.length} of ${ALL_PRESETS.length}`));
  console.log(pc.dim(`Run 'postmcp presets sync' to update offline cached schemas from GitHub.`));
  console.log();
}

export async function syncPresetsCommand(): Promise<void> {
  console.log(pc.cyan(`Syncing latest OpenAPI schemas for all presets...`));
  try {
    const synced = await syncAllPresets();
    console.log(pc.green(`Successfully synced ${synced.length} presets to local cache (~/.postmcp/presets/):`));
    for (const id of synced) {
      console.log(`  ${pc.green('●')} @${id}`);
    }
  } catch (err: any) {
    console.error(pc.red(`Failed to sync presets: ${err.message}`));
  }
}
