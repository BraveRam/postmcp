import * as path from 'node:path';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import { spawn, execSync, ChildProcess } from 'node:child_process';
import open from 'open';
import axios from 'axios';
import pc from 'picocolors';
import dotenv from 'dotenv';

export interface StudioCommandOptions {
  port?: string;
  noOpen?: boolean;
  dev?: boolean;
}

export function findStudioDir(): string {
  // 1. Check workspace and local monorepo paths first
  const workspaceCandidates = [
    path.resolve(process.cwd(), 'packages', 'studio'),
    path.resolve(__dirname, '..', '..', 'studio'),
    path.resolve(__dirname, '..', '..', '..', 'packages', 'studio'),
    path.resolve(__dirname, '..', '..', '..', '..', 'packages', 'studio'),
  ];

  for (const candidate of workspaceCandidates) {
    if (fs.existsSync(path.join(candidate, 'package.json'))) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(candidate, 'package.json'), 'utf-8'));
        if (pkg.name === '@postmcp/studio') {
          return candidate;
        }
      } catch {}
    }
  }

  // 2. Search upwards from cwd and __dirname for monorepo packages/studio
  for (const startDir of [process.cwd(), __dirname]) {
    let cur = startDir;
    for (let i = 0; i < 6; i++) {
      const candidate = path.join(cur, 'packages', 'studio');
      if (fs.existsSync(path.join(candidate, 'package.json'))) {
        try {
          const pkg = JSON.parse(fs.readFileSync(path.join(candidate, 'package.json'), 'utf-8'));
          if (pkg.name === '@postmcp/studio') {
            return candidate;
          }
        } catch {}
      }
      const parent = path.dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }
  }

  // 3. Try resolving via Node module resolution (published npx postmcp)
  try {
    const customRequire = typeof createRequire !== 'undefined' ? createRequire(__filename) : (require as NodeRequire);
    const pkgPath = customRequire.resolve('@postmcp/studio/package.json');
    if (fs.existsSync(pkgPath)) {
      const resolved = path.dirname(pkgPath);
      // If resolved into .pnpm cache inside a monorepo, prefer the live monorepo packages/studio
      const monorepoCandidate = path.resolve(resolved, '../../../../packages/studio');
      if (fs.existsSync(path.join(monorepoCandidate, 'package.json'))) {
        return monorepoCandidate;
      }
      // Check if installed package is an obsolete/stale version (older than CLI version)
      try {
        const studioPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const cliPkgPath = path.resolve(__dirname, '../package.json');
        let minVersion = '0.1.35';
        if (fs.existsSync(cliPkgPath)) {
          try {
            minVersion = JSON.parse(fs.readFileSync(cliPkgPath, 'utf-8')).version || minVersion;
          } catch {}
        }
        if (studioPkg.version && studioPkg.version < minVersion) {
          // Stale cache, skip to fallback or on-demand
        } else {
          return resolved;
        }
      } catch {
        return resolved;
      }
    }
  } catch {
    // Module resolution fallback
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

function hasCommand(cmd: string): boolean {
  try {
    execSync(`command -v ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export async function studioCommand(specArg?: string, options: StudioCommandOptions = {}): Promise<void> {
  const port = options.port || '3000';
  const baseUrl = `http://localhost:${port}`;
  const targetUrl = specArg ? `${baseUrl}?spec=${encodeURIComponent(specArg)}` : baseUrl;
  const studioDir = findStudioDir();
  const hasLocalStudio = fs.existsSync(path.join(studioDir, 'package.json'));

  // Preload workspace .env and .env.local into process.env before launching Studio
  const workspaceCwd = process.cwd();
  const searchDirs = [
    workspaceCwd,
    path.join(process.env.HOME || '', '.postmcp'),
    path.join(process.env.HOME || '', '.config', 'postmcp'),
    process.env.HOME || '',
  ];
  let searchCur = workspaceCwd;
  for (let i = 0; i < 6; i++) {
    if (!searchDirs.includes(searchCur)) {
      searchDirs.push(searchCur);
    }
    const parent = path.dirname(searchCur);
    if (parent === searchCur) break;
    searchCur = parent;
  }

  for (const dir of searchDirs) {
    if (!dir) continue;
    for (const envFile of ['.env.local', '.env']) {
      const fullEnvPath = path.join(dir, envFile);
      if (fs.existsSync(fullEnvPath)) {
        dotenv.config({ path: fullEnvPath });
      }
    }
  }

  console.log();
  console.log(pc.bold(pc.cyan(`Starting PostMCP Visual Web Studio...`)));
  console.log(`  Port: ${pc.bold(pc.green(port))}`);
  console.log(`  Studio Dir: ${pc.dim(hasLocalStudio ? studioDir : 'On-demand (@postmcp/studio)')}`);
  if (specArg) {
    console.log(`  Initial Spec: ${pc.dim(specArg)}`);
  }
  console.log();

  let child: ChildProcess | null = null;

  if (hasLocalStudio) {
    const srcDir = path.join(studioDir, 'src');
    const nextDir = path.join(studioDir, '.next');
    let isStale = false;
    if (fs.existsSync(srcDir) && fs.existsSync(nextDir)) {
      try {
        const nextMtime = fs.statSync(nextDir).mtimeMs;
        const pageMtime = fs.statSync(path.join(srcDir, 'app', 'page.tsx')).mtimeMs;
        if (pageMtime > nextMtime) {
          isStale = true;
        }
      } catch {}
    }

    const isBuilt = fs.existsSync(nextDir) && !isStale;
    const preferDev = options.dev || isStale;
    // Ensure Next.js server directory has CommonJS package.json to prevent
    // "ReferenceError: require is not defined in ES module scope" when studio has "type": "module"
    const serverDir = path.join(studioDir, '.next', 'server');
    const serverPkgJson = path.join(serverDir, 'package.json');
    if (fs.existsSync(serverDir) && !fs.existsSync(serverPkgJson)) {
      try {
        fs.writeFileSync(serverPkgJson, JSON.stringify({ type: 'commonjs' }, null, 2));
      } catch {}
    }

    // In standalone or monorepo environments, prefer npx next or pnpm
    const isPnpm = fs.existsSync(path.join(studioDir, '..', '..', 'pnpm-lock.yaml'));
    const command = isPnpm ? 'pnpm' : 'npx';
    const args = isPnpm
      ? isBuilt && !preferDev
        ? ['start', '--port', port]
        : ['dev', '--port', port]
      : isBuilt && !preferDev
      ? ['--yes', 'next', 'start', studioDir, '-p', port]
      : ['--yes', 'next', 'dev', studioDir, '-p', port];

    try {
      child = spawn(command, args, {
        cwd: studioDir,
        stdio: 'inherit',
        shell: true,
        env: {
          ...process.env,
          PORT: port,
          NEXT_PUBLIC_INITIAL_SPEC: specArg || '',
          STUDIO_INITIAL_SPEC: specArg || '',
          POSTMCP_WORKSPACE: process.cwd(),
          WORKSPACE_CWD: process.cwd(),
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
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.log(pc.yellow(`  Note: Running in detached standalone mode: ${errMsg}`));
    }
  } else {
    // Launch on-demand via bunx or npx
    console.log(pc.dim('  Studio not found locally. Launching on-demand (@postmcp/studio)...'));
    const isBun = hasCommand('bun');
    const runner = isBun ? 'bunx' : 'npx';
    const runnerArgs = isBun
      ? ['@postmcp/studio@latest', '-p', port]
      : ['--yes', '@postmcp/studio@latest', '-p', port];

    try {
      child = spawn(runner, runnerArgs, {
        cwd: process.cwd(),
        stdio: 'inherit',
        shell: true,
        env: {
          ...process.env,
          PORT: port,
          NEXT_PUBLIC_INITIAL_SPEC: specArg || '',
          STUDIO_INITIAL_SPEC: specArg || '',
          POSTMCP_WORKSPACE: process.cwd(),
          WORKSPACE_CWD: process.cwd(),
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
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.log(pc.yellow(`  Note: Failed to launch on-demand studio: ${errMsg}`));
    }
  }

  // Wait for server to become responsive
  const isReady = await waitForServer(baseUrl, 15000);

  if (isReady) {
    console.log(pc.green(`PostMCP Visual Web Studio ready at: ${pc.bold(targetUrl)}`));
  } else {
    console.log(pc.dim(`  Studio server starting at: ${targetUrl}`));
  }

  if (!options.noOpen) {
    try {
      await open(targetUrl);
      console.log(pc.dim(`Opening Web Studio in your default browser...`));
    } catch {
      console.log(pc.dim(`Please open ${targetUrl} in your browser.`));
    }
  }

  // If running interactively, wait for child process
  if (child) {
    await new Promise<void>((resolve) => {
      child?.on('close', () => resolve());
    });
  }
}
