import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseOpenAPI } from '@postmcp/core';
import type { GenerateCommandOptions } from '@postmcp/types';
import { resolvePresetSpec } from '../presets/index.js';
import { generateTypeScriptProject } from '../generators/typescript.js';
import { generatePythonProject } from '../generators/python.js';
import pc from 'picocolors';

export type { GenerateCommandOptions };

export async function generateCommand(specArg: string, options: GenerateCommandOptions): Promise<void> {
  let specPath: string | object = specArg;
  if (!specPath) {
    console.error(pc.red('Error: No OpenAPI spec provided. Usage: postmcp generate <spec-path-or-url-or-@preset>'));
    process.exit(1);
    return;
  }

  if (typeof specPath === 'string' && specPath.startsWith('@')) {
    try {
      specPath = await resolvePresetSpec(specPath);
    } catch (err: any) {
      console.error(pc.red(`Error resolving preset: ${err.message}`));
      process.exit(1);
      return;
    }
  }

  let spec;
  try {
    spec = await parseOpenAPI(specPath);
  } catch (err: any) {
    console.error(pc.red(`Failed to parse specification: ${err.message}`));
    process.exit(1);
  }

  const lang = (options.lang || 'typescript').toLowerCase();
  const outDir = path.resolve(options.out || `./${spec.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-mcp`);

  console.log(pc.cyan(`⚡ Generating standalone ${pc.bold(lang.toUpperCase())} MCP server for '${spec.title}'...`));

  let project;
  if (lang === 'ts' || lang === 'typescript') {
    project = generateTypeScriptProject(spec);
  } else if (lang === 'py' || lang === 'python') {
    project = generatePythonProject(spec);
  } else {
    console.error(pc.red(`Unsupported language '${lang}'. Supported languages: 'ts' (TypeScript), 'py' (Python/FastMCP).`));
    process.exit(1);
  }

  // Write files to target directory
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  for (const [relativePath, content] of Object.entries(project.files)) {
    const filePath = path.join(outDir, relativePath);
    const parentDir = path.dirname(filePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`  ${pc.green('+')} ${relativePath}`);
  }

  console.log();
  console.log(pc.green(`✔ Standalone MCP server successfully generated at:`));
  console.log(`  ${pc.bold(outDir)}`);
  console.log();
  console.log(pc.dim('Next steps:'));
  if (lang === 'ts' || lang === 'typescript') {
    console.log(`  cd ${path.relative(process.cwd(), outDir) || '.'}`);
    console.log('  npm install');
    console.log('  npm run build');
    console.log('  npm start');
  } else {
    console.log(`  cd ${path.relative(process.cwd(), outDir) || '.'}`);
    console.log('  pip install -r requirements.txt');
    console.log('  python server.py');
  }
}
