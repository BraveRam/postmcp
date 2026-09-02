import { NextResponse } from 'next/server';
import * as fs from 'node:fs';
import * as path from 'node:path';

export async function POST(request: Request) {
  try {
    const configData = await request.json();
    const targetFile = path.join(process.cwd(), 'postmcp.config.json');

    fs.writeFileSync(targetFile, JSON.stringify(configData, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      path: targetFile,
      message: 'Successfully saved postmcp.config.json to workspace.',
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to save configuration file to workspace.',
      },
      { status: 500 }
    );
  }
}
