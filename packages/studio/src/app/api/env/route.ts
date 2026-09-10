import { NextResponse } from 'next/server';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getScopedEnvKey } from '@/lib/env-scope';

function getWorkspaceDir(): string {
  const dir =
    process.env.POSTMCP_WORKSPACE ||
    process.env.WORKSPACE_CWD ||
    process.cwd();

  // If dir points inside packages/studio (e.g. running pnpm dev or inside monorepo), resolve to project root
  if (
    dir.endsWith(path.join('packages', 'studio')) ||
    dir.endsWith('packages/studio') ||
    fs.existsSync(path.join(dir, '..', '..', 'pnpm-workspace.yaml'))
  ) {
    const candidate = path.resolve(dir, '..', '..');
    if (
      fs.existsSync(path.join(candidate, 'package.json')) ||
      fs.existsSync(path.join(candidate, '.git')) ||
      fs.existsSync(path.join(candidate, 'pnpm-workspace.yaml'))
    ) {
      return candidate;
    }
  }

  return dir;
}

function updateEnvFile(filePath: string, updates: Record<string, string>) {
  let content = '';
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, 'utf-8');
  }

  const lines = content.split('\n');
  const remainingKeys = new Set(Object.keys(updates));

  const newLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) {
      const key = match[1];
      if (remainingKeys.has(key)) {
        remainingKeys.delete(key);
        return `${key}="${updates[key]}"`;
      }
    }
    return line;
  });

  for (const key of remainingKeys) {
    newLines.push(`${key}="${updates[key]}"`);
  }

  const finalContent = newLines.join('\n').replace(/\n*$/, '\n');
  fs.writeFileSync(filePath, finalContent, 'utf-8');
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const specTitle = searchParams.get('specTitle') || undefined;
    const serverUrl = searchParams.get('serverUrl') || undefined;
    const envVarName = searchParams.get('envVarName') || getScopedEnvKey(specTitle, serverUrl);

    const workspaceDir = getWorkspaceDir();
    const envPath = path.join(workspaceDir, '.env');
    let existsInFile = false;
    let fileValue = '';

    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (match && match[1] === envVarName) {
          existsInFile = true;
          fileValue = match[2].replace(/^["']|["']$/g, '');
          break;
        }
      }
    }

    const inMemoryValue = process.env[envVarName] || '';
    const activeValue = fileValue || inMemoryValue;

    const prefix = envVarName.replace(/_(API_KEY|TOKEN|SECRET_KEY|KEY|AUTH_TOKEN)$/i, '');
    const customHeaders: { key: string; val: string }[] = [];

    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (match && match[1].startsWith(`${prefix}_HEADER_`)) {
          const headerKey = match[1].slice(`${prefix}_HEADER_`.length).replace(/_/g, '-');
          const headerVal = match[2].replace(/^["']|["']$/g, '');
          customHeaders.push({ key: headerKey, val: headerVal });
        }
      }
    }

    for (const [k, v] of Object.entries(process.env)) {
      if (v && k.startsWith(`${prefix}_HEADER_`)) {
        const headerKey = k.slice(`${prefix}_HEADER_`.length).replace(/_/g, '-');
        if (!customHeaders.some((h) => h.key.toLowerCase() === headerKey.toLowerCase())) {
          customHeaders.push({ key: headerKey, val: v });
        }
      }
    }

    return NextResponse.json({
      envVarName,
      exists: existsInFile || Boolean(inMemoryValue),
      envPath,
      value: activeValue || '',
      maskedValue: activeValue
        ? activeValue.length > 8
          ? `${activeValue.slice(0, 4)}...${activeValue.slice(-4)}`
          : '••••••••'
        : undefined,
      hasValue: Boolean(activeValue),
      customHeaders,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to check environment variables.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      specTitle,
      serverUrl,
      envVarName: customVarName,
      token,
      customHeaders,
    } = body;

    const envVarName = (customVarName || getScopedEnvKey(specTitle, serverUrl)).trim();
    if (!envVarName) {
      return NextResponse.json(
        { error: 'Environment variable name is required.' },
        { status: 400 }
      );
    }

    const updates: Record<string, string> = {};
    if (typeof token === 'string' && token.trim().length > 0) {
      updates[envVarName] = token.trim();
      process.env[envVarName] = token.trim();
    }

    if (Array.isArray(customHeaders)) {
      const prefix = envVarName.replace(/_(API_KEY|TOKEN|SECRET_KEY|KEY|AUTH_TOKEN)$/i, '');
      for (const header of customHeaders) {
        if (header.key && header.val) {
          const headerKey = `${prefix}_HEADER_${header.key.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;
          updates[headerKey] = header.val;
          process.env[headerKey] = header.val;
        }
      }
    }

    const workspaceDir = getWorkspaceDir();
    const envPath = path.join(workspaceDir, '.env');

    updateEnvFile(envPath, updates);

    return NextResponse.json({
      success: true,
      envVarName,
      envPath,
      updatedKeys: Object.keys(updates),
      message: `Successfully saved ${Object.keys(updates).join(', ')} to ${envPath}`,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save to .env file.' },
      { status: 500 }
    );
  }
}
