#!/usr/bin/env node
import { createRequire } from 'node:module';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

let binPath = '';
try {
  binPath = require.resolve('@postmcp/cli/bin');
} catch {
  const localCandidate = path.resolve(__dirname, '../cli/dist/bin.js');
  if (fs.existsSync(localCandidate)) {
    binPath = localCandidate;
  }
}

if (binPath) {
  await import(binPath);
} else {
  console.error('Error: Failed to resolve @postmcp/cli executable.');
  process.exit(1);
}
