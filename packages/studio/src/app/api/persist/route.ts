import { NextResponse } from 'next/server';
import * as fs from 'node:fs';
import * as path from 'node:path';

export async function POST(request: Request) {
  try {
    const configData = await request.json();
    let workspaceDir = process.env.POSTMCP_WORKSPACE || process.env.WORKSPACE_CWD || process.cwd();
    if (
      workspaceDir.endsWith(path.join('packages', 'studio')) ||
      workspaceDir.endsWith('packages/studio') ||
      fs.existsSync(path.join(workspaceDir, '..', '..', 'pnpm-workspace.yaml'))
    ) {
      const candidate = path.resolve(workspaceDir, '..', '..');
      if (
        fs.existsSync(path.join(candidate, 'package.json')) ||
        fs.existsSync(path.join(candidate, '.git')) ||
        fs.existsSync(path.join(candidate, 'pnpm-workspace.yaml'))
      ) {
        workspaceDir = candidate;
      }
    }
    const targetFile = path.join(workspaceDir, 'postmcp.config.json');

    fs.writeFileSync(targetFile, JSON.stringify(configData, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      path: targetFile,
      message: `Successfully saved postmcp.config.json to ${targetFile}`,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to save configuration file to workspace.',
      },
      { status: 500 }
    );
  }
}
