import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import { generatePythonProject, generateTypeScriptProject, generateProject } from '../src/codegen/index.js';
import { NormalizedSpec } from '../src/parser/types.js';

describe('Phase 5: Code Generators (@postmcp/core/codegen)', () => {
  const complexSpec: NormalizedSpec = {
    title: 'Acme Payments API """Special""" & <Chars>',
    version: '2.1.0',
    description: 'API with multi-line """quotes""", `backticks`, and complex schemas.',
    servers: [{ url: 'https://api.acmepay.com/v1' }],
    securitySchemes: {
      apiKeyHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
      },
    },
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
          { name: 'version_code', in: 'query', required: false, schema: { type: 'integer', enum: [1, 2, 3] } },
          { name: 'session_id', in: 'cookie', required: false, schema: { type: 'string' } },
        ],
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'integer' },
            status: { type: 'string', enum: ['succeeded', 'pending', 'failed'] },
            version_code: { type: 'integer', enum: [1, 2, 3] },
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
          { name: 'auth_token', in: 'cookie', required: true, schema: { type: 'string' } },
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
      {
        id: 'uploadRawText',
        summary: 'Upload Raw Text',
        description: 'Uploads raw string payload without wrapper object',
        method: 'post',
        path: '/upload/text',
        riskTier: 'MUTATION',
        inputSchema: {
          type: 'object',
          required: ['requestBody'],
          properties: {
            requestBody: { type: 'string', description: 'Raw text content' },
          },
        },
      },
      {
        id: 'batchDeleteItems',
        summary: 'Batch Delete Items',
        description: 'Accepts an array of item IDs',
        method: 'delete',
        path: '/items/batch',
        riskTier: 'MUTATION',
        inputSchema: {
          type: 'object',
          required: ['requestBody'],
          properties: {
            requestBody: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of item IDs to delete',
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

    it('should handle primitive and array request bodies as direct payloads', () => {
      const project = generatePythonProject(complexSpec);
      const code = project.files['server.py'];

      expect(code).toContain('async def upload_raw_text(');
      expect(code).toContain('body: str = Field(');
      expect(code).toContain('async def batch_delete_items(');
      expect(code).toContain('body: list[str] = Field(');
    });

    it('should serialize cookie parameters into cookies dict and safely escape module docstrings', () => {
      const project = generatePythonProject(complexSpec);
      const code = project.files['server.py'];

      expect(code).toContain('auth_token: str');
      expect(code).toContain('req_cookies: dict[str, str] = {}');
      expect(code).toContain('req_cookies["auth_token"] = str(auth_token)');
      expect(code).toContain('cookies=req_cookies');
      expect(code).toContain('DRY_RUN');
      expect(code).toContain('headers["X-API-Key"] = API_KEY');
      expect(code).not.toContain('"""Special"""'); // escaped as \"\"\"Special\"\"\"
    });

    it('should compile server.py without syntax errors using python3 -m py_compile', () => {
      const project = generatePythonProject(complexSpec);
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'postmcp-py-test-'));
      const serverPyPath = path.join(tempDir, 'server.py');

      try {
        fs.writeFileSync(serverPyPath, project.files['server.py'], 'utf-8');
        expect(() => {
          execSync(`python3 -m py_compile ${serverPyPath}`, { stdio: 'pipe' });
        }).not.toThrow();
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('TypeScript MCP SDK Generator', () => {
    it('should generate all required TypeScript project files', () => {
      const project = generateTypeScriptProject(complexSpec);

      expect(project.files['package.json']).toBeDefined();
      expect(project.files['tsconfig.json']).toBeDefined();
      expect(project.files['src/index.ts']).toBeDefined();
      expect(project.files['README.md']).toBeDefined();
      expect(project.files['.env.example']).toBeDefined();
      expect(project.files['.gitignore']).toBeDefined();
    });

    it('should handle primitive and array request bodies as direct payloads without object wrapping', () => {
      const project = generateTypeScriptProject(complexSpec);
      const code = project.files['src/index.ts'];

      expect(code).toContain('"uploadRawText"');
      expect(code).toContain('"requestBody": z.string()');
      expect(code).toContain('const bodyData = args["requestBody"]');
      expect(code).toContain('"batchDeleteItems"');
      expect(code).toContain('"requestBody": z.array(z.string())');
    });

    it('should generate numeric enums with z.union([z.literal(...)]), cookies into headers, and recursive objects', () => {
      const project = generateTypeScriptProject(complexSpec);
      const code = project.files['src/index.ts'];

      expect(code).toContain("import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'");
      expect(code).toContain("import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'");
      expect(code).toContain('server.tool(');
      expect(code).toContain('"listCharges"');
      expect(code).toContain('"createRefund"');
      // String enum
      expect(code).toContain('z.enum(["succeeded", "pending", "failed"])');
      // Numeric enum uses z.union of z.literal
      expect(code).toContain('z.union([z.literal(1), z.literal(2), z.literal(3)])');
      // Cookie parameter in Cookie header
      expect(code).toContain("reqHeaders['Cookie'] = cookieParts.join('; ')");
      // Merged path parameter and body properties
      expect(code).toContain('"charge_id": z.string()');
      expect(code).toContain('"amount": z.number().int().min(50)');
      expect(code).toContain('"notes": z.string().optional()');
      expect(code).toContain('formatTokenDiet');
      expect(code).toContain('"X-API-Key": API_KEY');
      expect(code).toContain('DRY_RUN');
    });

    it('should configure package.json with dependencies and ES module type', () => {
      const project = generateTypeScriptProject(complexSpec);
      const pkg = JSON.parse(project.files['package.json']);

      expect(pkg.name).toBe('acme-payments-api-special-chars');
      expect(pkg.type).toBe('module');
      expect(pkg.dependencies['@modelcontextprotocol/sdk']).toBeDefined();
      expect(pkg.dependencies['zod']).toBeDefined();
    });

    it('should compile generated TypeScript project using tsc without errors', () => {
      const project = generateTypeScriptProject(complexSpec);
      const tempDir = path.resolve(__dirname, '..', 'temp-ts-codegen-test');

      try {
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        const srcDir = path.join(tempDir, 'src');
        if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });

        fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), project.files['tsconfig.json'], 'utf-8');
        fs.writeFileSync(path.join(tempDir, 'src/index.ts'), project.files['src/index.ts'], 'utf-8');

        expect(() => {
          execSync(`npx tsc --noEmit -p ${path.join(tempDir, 'tsconfig.json')}`, { stdio: 'pipe' });
        }).not.toThrow();
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
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
