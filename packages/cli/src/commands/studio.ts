import * as path from 'node:path';
import * as fs from 'node:fs';
import { spawn, ChildProcess } from 'node:child_process';
import type { StudioCommandOptions } from '@postmcp/types';
import open from 'open';
import axios from 'axios';
import pc from 'picocolors';

export type { StudioCommandOptions };

export function findStudioDir(): string {
  // Check common locations relative to CLI package
  const candidates = [
    path.resolve(__dirname, '..', '..', 'studio'),
    path.resolve(__dirname, '..', '..', '..', 'packages', 'studio'),
    path.resolve(process.cwd(), 'packages', 'studio'),
    path.resolve(process.cwd(), 'node_modules', '@postmcp', 'studio'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'package.json'))) {
      return candidate;
    }
  }

  // Fallback to packages/studio in workspace
  return path.resolve(process.cwd(), 'packages', 'studio');
}

export async function waitForServer(url: string, timeoutMs: number = 20000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await axios.get(url, { timeout: 1000, validateStatus: () => true });
      if (res.status >= 200 && res.status < 500) {
        return true;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

export async function studioCommand(specArg?: string, options: StudioCommandOptions = {}): Promise<void> {
  const port = options.port || '3000';
  const url = `http://localhost:${port}`;
  const studioDir = findStudioDir();

  console.log();
  console.log(pc.bold(pc.cyan(`⚡ Starting PostMCP Visual Web Studio...`)));
  console.log(`  Port: ${pc.bold(pc.green(port))}`);
  console.log(`  Studio Dir: ${pc.dim(studioDir)}`);
  if (specArg) {
    console.log(`  Initial Spec: ${pc.dim(specArg)}`);
  }
  console.log();

  let child: ChildProcess | null = null;

  if (fs.existsSync(studioDir)) {
    const isBuilt = fs.existsSync(path.join(studioDir, '.next'));
    const command = 'pnpm';
    const args = isBuilt ? ['start', '--port', port] : ['dev', '--port', port];

    try {
      child = spawn(command, args, {
        cwd: studioDir,
        stdio: 'inherit',
        shell: true,
        env: {
          ...process.env,
          PORT: port,
          NEXT_PUBLIC_INITIAL_SPEC: specArg || '',
        },
      });

      const cleanup = () => {
        if (child) {
          try {
            child.kill('SIGINT');
          } catch {
            // Ignore kill errors
          }
        }
      };

      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
      process.on('exit', cleanup);
    } catch (err: any) {
      console.log(pc.yellow(`  Note: Running in detached standalone mode: ${err.message}`));
    }
  }

  // Wait for server to become responsive
  const isReady = await waitForServer(url, 15000);

  if (isReady) {
    console.log(pc.green(`✔ PostMCP Visual Web Studio ready at: ${pc.bold(url)}`));
  } else {
    console.log(pc.dim(`  Studio server starting at: ${url}`));
  }

  if (!options.noOpen) {
    try {
      await open(url);
      console.log(pc.dim(`Opening Web Studio in your default browser...`));
    } catch {
      console.log(pc.dim(`Please open ${url} in your browser.`));
    }
  }

  // If running interactively, wait for child process
  if (child) {
    await new Promise<void>((resolve) => {
      child?.on('close', () => resolve());
    });
  }
}
