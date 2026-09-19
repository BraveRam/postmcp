#!/usr/bin/env node
import { spawn } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const studioDir = path.resolve(__dirname, '..');

// Ensure Next.js server directory has CommonJS package.json to prevent
// "ReferenceError: require is not defined in ES module scope" when studio has "type": "module"
const serverDir = path.join(studioDir, '.next', 'server');
const serverPkgJson = path.join(serverDir, 'package.json');
if (fs.existsSync(serverDir) && !fs.existsSync(serverPkgJson)) {
  try {
    fs.writeFileSync(serverPkgJson, JSON.stringify({ type: 'commonjs' }, null, 2));
  } catch {}
}

const args = process.argv.slice(2);
let port = process.env.PORT || '3000';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '-p' || args[i] === '--port') {
    port = args[i + 1] || port;
  }
}

const child = spawn('npx', ['--yes', 'next', 'start', studioDir, '-p', port], {
  cwd: studioDir,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    PORT: port,
  },
});

const cleanup = () => {
  try {
    child.kill('SIGINT');
  } catch {}
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
