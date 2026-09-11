import pc from 'picocolors';
import open from 'open';
import axios from 'axios';

export interface DocsCommandOptions {
  local?: boolean;
}

export async function docsCommand(options: DocsCommandOptions = {}): Promise<void> {
  let targetUrl = 'https://github.com/BraveRam/postmcp#readme';

  if (options.local) {
    targetUrl = 'http://localhost:3000/docs';
  } else {
    // Probe if local Studio is running and responsive
    try {
      const res = await axios.get('http://localhost:3000/docs', { timeout: 800, validateStatus: () => true });
      if (res.status >= 200 && res.status < 500) {
        targetUrl = 'http://localhost:3000/docs';
      }
    } catch {
      // Local studio is not running, default to online documentation
    }
  }

  console.log();
  console.log(pc.cyan(`Opening PostMCP documentation: ${pc.bold(targetUrl)}`));
  console.log();

  try {
    await open(targetUrl);
  } catch {
    console.log(pc.dim(`Please open ${targetUrl} in your browser.`));
  }
}
