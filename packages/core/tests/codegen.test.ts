import { describe, it, expect } from 'vitest';
import { generatePythonProject, generateTypeScriptProject, generateProject } from '../src/codegen/index.js';
import { NormalizedSpec } from '../src/parser/types.js';

describe('Phase 5: Code Generators (@postmcp/core/codegen)', () => {
  const sampleSpec: NormalizedSpec = {
    title: 'Acme Payments API',
    version: '2.1.0',
    description: 'API for processing payments and managing customers.',
    servers: [{ url: 'https://api.acmepay.com/v1' }],
    operations: [
      {
        id: 'listCharges',
        summary: 'List Charges',
        description: 'Returns a list of customer charges',
        method: 'get',
        path: '/charges',
        riskTier: 'READ_ONLY',
        parameters: [
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer' } },
          { name: 'starting_after', in: 'query', required: false, schema: { type: 'string' } },
        ],
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'integer' },
            starting_after: { type: 'string' },
          },
        },
      },
      {
        id: 'createRefund',
        summary: 'Create Refund',
        description: 'Issues a refund for a specific charge',
        method: 'post',
        path: '/charges/{charge_id}/refunds',
        riskTier: 'MUTATION',
        parameters: [
          { name: 'charge_id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        inputSchema: {
          type: 'object',
          properties: {
            charge_id: { type: 'string' },
            amount: { type: 'integer' },
            reason: { type: 'string' },
          },
          required: ['charge_id'],
        },
      },
    ],
  };

  describe('Python FastMCP Generator', () => {
    it('should generate all required Python FastMCP project files', () => {
      const project = generatePythonProject(sampleSpec);

      expect(project.files['pyproject.toml']).toBeDefined();
      expect(project.files['server.py']).toBeDefined();
      expect(project.files['requirements.txt']).toBeDefined();
      expect(project.files['README.md']).toBeDefined();
      expect(project.files['.env.example']).toBeDefined();
      expect(project.files['.gitignore']).toBeDefined();
    });

    it('should generate valid FastMCP server.py with type hints and async httpx client', () => {
      const project = generatePythonProject(sampleSpec);
      const code = project.files['server.py'];

      expect(code).toContain('from mcp.server.fastmcp import FastMCP');
      expect(code).toContain('mcp = FastMCP("Acme Payments API")');
      expect(code).toContain('@mcp.tool()');
      expect(code).toContain('async def list_charges');
      expect(code).toContain('async def create_refund');
      expect(code).toContain('format_token_diet');
      expect(code).toContain('async with httpx.AsyncClient');
      expect(code).toContain('mcp.run()');
    });

    it('should configure pyproject.toml with modern uv dependencies', () => {
      const project = generatePythonProject(sampleSpec);
      const toml = project.files['pyproject.toml'];

      expect(toml).toContain('name = "acme_payments_api"');
      expect(toml).toContain('mcp[cli]');
      expect(toml).toContain('httpx');
      expect(toml).toContain('pydantic');
    });
  });

  describe('TypeScript MCP SDK v2 Generator', () => {
    it('should generate all required TypeScript project files', () => {
      const project = generateTypeScriptProject(sampleSpec);

      expect(project.files['package.json']).toBeDefined();
      expect(project.files['tsconfig.json']).toBeDefined();
      expect(project.files['src/index.ts']).toBeDefined();
      expect(project.files['README.md']).toBeDefined();
      expect(project.files['.env.example']).toBeDefined();
      expect(project.files['.gitignore']).toBeDefined();
    });

    it('should generate valid TypeScript index.ts using MCP SDK v2 McpServer and registerTool', () => {
      const project = generateTypeScriptProject(sampleSpec);
      const code = project.files['src/index.ts'];

      expect(code).toContain("import { McpServer } from '@modelcontextprotocol/server'");
      expect(code).toContain("import { StdioServerTransport } from '@modelcontextprotocol/server/stdio'");
      expect(code).toContain("server.registerTool(");
      expect(code).toContain("'listCharges'");
      expect(code).toContain("'createRefund'");
      expect(code).toContain("z.object(");
      expect(code).toContain("formatTokenDiet");
    });

    it('should configure package.json with v2 dependencies and ES module type', () => {
      const project = generateTypeScriptProject(sampleSpec);
      const pkg = JSON.parse(project.files['package.json']);

      expect(pkg.name).toBe('acme-payments-api');
      expect(pkg.type).toBe('module');
      expect(pkg.dependencies['@modelcontextprotocol/server']).toBeDefined();
      expect(pkg.dependencies['@modelcontextprotocol/node']).toBeDefined();
      expect(pkg.dependencies['zod']).toBeDefined();
    });
  });

  describe('Unified generateProject dispatcher', () => {
    it('should dispatch to python and typescript based on options', () => {
      const pyProject = generateProject(sampleSpec, { target: 'python' });
      expect(pyProject.files['server.py']).toBeDefined();

      const tsProject = generateProject(sampleSpec, { target: 'typescript' });
      expect(tsProject.files['src/index.ts']).toBeDefined();
    });
  });
});
