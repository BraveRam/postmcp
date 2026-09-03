import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { specName, presetId, specUrl, baseUrl, envVars, enabledOperations, fieldMasks, macros, target } =
      await request.json();

    const serverKey = (presetId || specName || 'custom-api').toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    const specArg = presetId ? `@${presetId}` : specUrl || './openapi.json';

    const args = ['run', specArg];
    if (baseUrl) {
      args.push('--base-url', baseUrl);
    }

    const envMap: Record<string, string> = {};
    if (envVars && typeof envVars === 'object') {
      for (const [k, v] of Object.entries(envVars)) {
        if (typeof v === 'string' && v.trim()) {
          envMap[k] = v;
        }
      }
    }

    // Cursor Configuration (.cursor/mcp.json)
    const cursorConfig = {
      mcpServers: {
        [serverKey]: {
          command: 'npx',
          args: ['-y', '@postmcp/cli', ...args],
          env: envMap,
        },
      },
    };

    // Claude Desktop Configuration (claude_desktop_config.json)
    const claudeConfig = {
      mcpServers: {
        [serverKey]: {
          command: 'npx',
          args: ['-y', '@postmcp/cli', ...args],
          env: envMap,
        },
      },
    };

    // Windsurf Configuration (mcp_config.json)
    const windsurfConfig = {
      mcpServers: {
        [serverKey]: {
          command: 'npx',
          args: ['-y', '@postmcp/cli', ...args],
          env: envMap,
        },
      },
    };

    // PostMCP Project Config (postmcp.config.json)
    const postmcpConfig = {
      spec: specArg,
      baseUrl: baseUrl || undefined,
      transport: 'stdio',
      tokenDiet: {
        enabled: true,
        maxTokens: 2500,
        convertToMarkdownTable: true,
      },
      fieldMasks: fieldMasks || {},
      macros: macros || [],
      enabledOperations: enabledOperations || undefined,
    };

    return NextResponse.json({
      cursor: JSON.stringify(cursorConfig, null, 2),
      claude: JSON.stringify(claudeConfig, null, 2),
      windsurf: JSON.stringify(windsurfConfig, null, 2),
      postmcp: JSON.stringify(postmcpConfig, null, 2),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: err.message || 'Failed to generate configuration export.',
      },
      { status: 500 }
    );
  }
}
