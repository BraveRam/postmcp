import open from 'open';
import pc from 'picocolors';

export interface StudioCommandOptions {
  port?: string;
  noOpen?: boolean;
}

export async function studioCommand(specArg?: string, options: StudioCommandOptions = {}): Promise<void> {
  const port = options.port || '3000';
  const url = `http://localhost:${port}`;

  console.log();
  console.log(pc.bold(pc.cyan(`⚡ PostMCP Visual Web Studio`)));
  console.log(`  URL: ${pc.bold(pc.green(url))}`);
  if (specArg) {
    console.log(`  Initial Spec: ${pc.dim(specArg)}`);
  }
  console.log();

  if (!options.noOpen) {
    try {
      await open(url);
      console.log(pc.dim(`Opening Web Studio in your default browser...`));
    } catch {
      console.log(pc.dim(`Please open ${url} in your browser.`));
    }
  }
}
