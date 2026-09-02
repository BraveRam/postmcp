import { describe, it, expect } from 'vitest';
import { generateTypeScriptProject, generatePythonProject } from '@postmcp/core';
import { NormalizedSpec } from '@postmcp/core';

describe('Standalone MCP Server Code Generators', () => {
  const sampleSpec: NormalizedSpec = {
    title: 'Stripe Payments Service',
    version: '2024-01-01',
    description: 'Payments API',
    servers: [{ url: 'https://api.stripe.com/v1' }],
    operations: [
      {
        id: 'createRefund',
        method: 'post',
        path: '/refunds',
        summary: 'Create a refund',
        description: 'Creates a new refund for a charge',
        tags: ['refunds'],
        parameters: [],
        inputSchema: {
          type: 'object',
          required: ['charge_id', 'amount'],
          properties: {
            charge_id: { type: 'string' },
            amount: { type: 'number' },
            reason: { type: 'string' },
          },
        },
        riskTier: 'CRITICAL',
      },
      {
        id: 'listCharges',
        method: 'get',
        path: '/charges',
        summary: 'List charges',
        description: 'Returns list of charges',
        tags: ['charges'],
        parameters: [],
        inputSchema: { type: 'object' },
        riskTier: 'READ_ONLY',
      },
    ],
    securitySchemes: {},
  };

  it('should generate complete TypeScript MCP SDK v2 server files', () => {
    const project = generateTypeScriptProject(sampleSpec);

    expect(project.files['package.json']).toBeDefined();
    expect(project.files['tsconfig.json']).toBeDefined();
    expect(project.files['src/index.ts']).toBeDefined();
    expect(project.files['README.md']).toBeDefined();

    const packageJson = JSON.parse(project.files['package.json']);
    expect(packageJson.dependencies['@modelcontextprotocol/server']).toBeDefined();
    expect(packageJson.dependencies['@modelcontextprotocol/node']).toBeDefined();
    expect(packageJson.dependencies['axios']).toBeDefined();

    const indexTs = project.files['src/index.ts'];
    expect(indexTs).toContain('"createRefund"');
    expect(indexTs).toContain('"listCharges"');
    expect(indexTs).toContain('StdioServerTransport');
    expect(indexTs).toContain('server.registerTool');
  });

  it('should generate complete Python FastMCP server files', () => {
    const project = generatePythonProject(sampleSpec);

    expect(project.files['server.py']).toBeDefined();
    expect(project.files['requirements.txt']).toBeDefined();
    expect(project.files['pyproject.toml']).toBeDefined();
    expect(project.files['README.md']).toBeDefined();

    const serverPy = project.files['server.py'];
    expect(serverPy).toContain('from mcp.server.fastmcp import FastMCP');
    expect(serverPy).toContain('@mcp.tool()');
    expect(serverPy).toContain('async def create_refund');
    expect(serverPy).toContain('charge_id: str');
  });
});
