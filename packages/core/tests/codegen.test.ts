import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import { generatePythonProject, generateTypeScriptProject, generateProject } from '../src/codegen/index.js';
import { NormalizedSpec } from '../src/parser/types.js';

describe('Phase 5: Code Generators (@postmcp/core/codegen)', () => {
  const complexSpec: NormalizedSpec = {
    title: 'Acme Payments API "Special" & <Chars>',
    version: '2.1.0',
    description: 'API with multi-line "quotes", `backticks`, and complex schemas.',
    servers: [{ url: 'https://api.acmepay.com/v1' }],
    operations: [
      {
        id: 'listCharges',
        summary: 'List Charges',
        description: 'Returns customer charges with "quotes" and backticks `sample`.',
        method: 'get',
        path: '/charges',
        riskTier: 'READ_ONLY',
        parameters: [
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['succeeded', 'pending', 'failed'] } },
        ],
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'integer' },
            status: { type: 'string', enum: ['succeeded', 'pending', 'failed'] },
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
          { name: 'charge_id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'idempotency-key', in: 'header', required: false, schema: { type: 'string' } },
        ],
        inputSchema: {
          type: 'object',
          required: ['amount', 'reason'],
          properties: {
            amount: { type: 'integer', minimum: 50, description: 'Amount in cents' },
            reason: { type: 'string', enum: ['duplicate', 'fraudulent', 'requested_by_customer'] },
            metadata: {
              type: 'object',
              properties: {
                notes: { type: 'string' },
                tags: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
    ],
  };

  describe('Python FastMCP + Pydantic Generator', () => {
    it('should generate all required Python FastMCP project files', () => {
      const project = generatePythonProject(complexSpec);

      expect(project.files['pyproject.toml']).toBeDefined();
      expect(project.files['server.py']).toBeDefined();
      expect(project.files['requirements.txt']).toBeDefined();
      expect(project.files['README.md']).toBeDefined();
      expect(project.files['.env.example']).toBeDefined();
      expect(project.files['.gitignore']).toBeDefined();
    });

    it('should generate valid Pydantic models with Field and ConfigDict', () => {
      const project = generatePythonProject(complexSpec);
      const code = project.files['server.py'];

      expect(code).toContain('from pydantic import BaseModel, Field, ConfigDict');
      expect(code).toContain('class CreateRefundRequestBody(BaseModel):');
      expect(code).toContain('amount: int = Field(');
      expect(code).toContain('reason: Literal["duplicate", "fraudulent", "requested_by_customer"]');
      expect(code).toContain('model_config = ConfigDict(populate_by_name=True, extra="allow")');
    });

    it('should generate FastMCP tools that accept path/query parameters AND Pydantic request body', () => {
      const project = generatePythonProject(complexSpec);
      const code = project.files['server.py'];

      expect(code).toContain('from mcp.server.fastmcp import FastMCP');
      expect(code).toContain('@mcp.tool()');
      expect(code).toContain('async def create_refund(');
      expect(code).toContain('charge_id: str');
      expect(code).toContain('body: CreateRefundRequestBody = Field(');
      expect(code).toContain('format_token_diet');
      expect(code).toContain('async with httpx.AsyncClient(base_url=BASE_URL,');
      expect(code).toContain('method="POST"');
      expect(code).toContain('json=body.model_dump(by_alias=True, exclude_none=True) if body else None');
    });

    it('should compile server.py without syntax errors using python3 -m py_compile', () => {
      const project = generatePythonProject(complexSpec);
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'postmcp-py-test-'));
      const serverPyPath = path.join(tempDir, 'server.py');

      try {
        fs.writeFileSync(serverPyPath, project.files['server.py'], 'utf-8');
        // Compile with Python 3 byte-compiler
        expect(() => {
          execSync(`python3 -m py_compile ${serverPyPath}`, { stdio: 'pipe' });
        }).not.toThrow();
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('TypeScript MCP SDK v2 Generator', () => {
    it('should generate all required TypeScript project files', () => {
      const project = generateTypeScriptProject(complexSpec);

      expect(project.files['package.json']).toBeDefined();
      expect(project.files['tsconfig.json']).toBeDefined();
      expect(project.files['src/index.ts']).toBeDefined();
      expect(project.files['README.md']).toBeDefined();
      expect(project.files['.env.example']).toBeDefined();
      expect(project.files['.gitignore']).toBeDefined();
    });

    it('should generate recursive Zod schemas with enums, nested objects, and merged parameters', () => {
      const project = generateTypeScriptProject(complexSpec);
      const code = project.files['src/index.ts'];

      expect(code).toContain("import { McpServer } from '@modelcontextprotocol/server'");
      expect(code).toContain("import { StdioServerTransport } from '@modelcontextprotocol/server/stdio'");
      expect(code).toContain('server.registerTool(');
      expect(code).toContain('"listCharges"');
      expect(code).toContain('"createRefund"');
      expect(code).toContain('z.enum(["succeeded", "pending", "failed"])');
      expect(code).toContain('z.enum(["duplicate", "fraudulent", "requested_by_customer"])');
      expect(code).toContain('"charge_id": z.string()');
      expect(code).toContain('"amount": z.number().int().min(50)');
      expect(code).toContain('"notes": z.string().optional()');
      expect(code).toContain('formatTokenDiet');
    });

    it('should configure package.json with v2 dependencies and ES module type', () => {
      const project = generateTypeScriptProject(complexSpec);
      const pkg = JSON.parse(project.files['package.json']);

      expect(pkg.name).toBe('acme-payments-api-special-chars');
      expect(pkg.type).toBe('module');
      expect(pkg.dependencies['@modelcontextprotocol/server']).toBeDefined();
      expect(pkg.dependencies['@modelcontextprotocol/node']).toBeDefined();
      expect(pkg.dependencies['zod']).toBeDefined();
    });
  });

  describe('Unified generateProject dispatcher', () => {
    it('should dispatch to python and typescript based on options', () => {
      const pyProject = generateProject(complexSpec, { target: 'python' });
      expect(pyProject.files['server.py']).toBeDefined();

      const tsProject = generateProject(complexSpec, { target: 'typescript' });
      expect(tsProject.files['src/index.ts']).toBeDefined();
    });
  });
});
