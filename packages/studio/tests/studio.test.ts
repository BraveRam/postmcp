import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { GET as getPresetsHandler } from '../src/app/api/presets/route.js';
import { POST as parseHandler } from '../src/app/api/parse/route.js';
import { POST as tokenDietHandler } from '../src/app/api/token-diet/route.js';
import { POST as exportHandler } from '../src/app/api/export/route.js';
import { POST as persistHandler } from '../src/app/api/persist/route.js';
import { POST as sandboxHandler } from '../src/app/api/sandbox/route.js';

describe('PostMCP Visual Web Studio API Routes (@postmcp/studio)', () => {
  it('GET /api/presets should return all 60+ curated presets with categories', async () => {
    const req = new Request('http://localhost:3000/api/presets?category=all');
    const res = await getPresetsHandler(req);
    const data = await res.json();

    expect(data.presets).toBeDefined();
    expect(data.presets.length).toBeGreaterThanOrEqual(60);
    expect(data.categories).toContain('Developer Tools');
    expect(data.categories).toContain('Payments & Commerce');

    const stripe = data.presets.find((p: { id: string; name: string }) => p.id === 'stripe');
    expect(stripe).toBeDefined();
    expect(stripe.name).toBe('Stripe API');
  });

  it('POST /api/parse should load presets with macros and fieldMasks attached', async () => {
    const req = new Request('http://localhost:3000/api/parse', {
      method: 'POST',
      body: JSON.stringify({ presetId: 'github' }),
    });
    const res = await parseHandler(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.spec).toBeDefined();
    expect(data.spec.title).toBe('GitHub REST API');
    expect(data.spec.operations.length).toBeGreaterThan(0);
    expect(data.spec.macros?.length).toBeGreaterThan(0);
    expect(data.spec.tokenDiet?.fieldMasks).toBeDefined();
    expect(data.spec.tokenDiet?.fieldMasks?.['/repos/{owner}/{repo}/issues']).toBeDefined();
  });

  it('POST /api/token-diet should compute real token reductions and Markdown tables', async () => {
    const samplePayload = [
      { id: 'usr_1', name: 'Alice', email: 'alice@example.com', role: 'admin' },
      { id: 'usr_2', name: 'Bob', email: 'bob@example.com', role: 'member' },
    ];

    const req = new Request('http://localhost:3000/api/token-diet', {
      method: 'POST',
      body: JSON.stringify({
        data: samplePayload,
        options: {
          enabled: true,
          fieldMasks: ['name', 'email'],
          convertToMarkdownTable: true,
        },
      }),
    });

    const res = await tokenDietHandler(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.result).toBeDefined();
    expect(data.result.text).toContain('| name | email |');
    expect(data.result.text).not.toContain('usr_1'); // Pruned by mask
    expect(data.result.rawEstimatedTokens).toBeGreaterThan(0);
  });

  it('POST /api/export should generate ready-to-use Cursor, Claude, Windsurf, and PostMCP configs', async () => {
    const req = new Request('http://localhost:3000/api/export', {
      method: 'POST',
      body: JSON.stringify({
        specName: 'Stripe API',
        presetId: 'stripe',
        baseUrl: 'https://api.stripe.com',
        envVars: { STRIPE_SECRET_KEY: 'sk_test_123' },
        enabledOperations: { createRefund: true },
        fieldMasks: { '/v1/refunds': ['id', 'amount', 'status'] },
        macros: [],
      }),
    });

    const res = await exportHandler(req);
    const data = await res.json();

    expect(data.cursor).toBeDefined();
    expect(data.claude).toBeDefined();
    expect(data.windsurf).toBeDefined();
    expect(data.postmcp).toBeDefined();

    const cursorObj = JSON.parse(data.cursor);
    expect(cursorObj.mcpServers.stripe.command).toBe('npx');
    expect(cursorObj.mcpServers.stripe.args).toContain('@stripe');
    expect(cursorObj.mcpServers.stripe.env.STRIPE_SECRET_KEY).toBe('sk_test_123');

    const postmcpObj = JSON.parse(data.postmcp);
    expect(postmcpObj.spec).toBe('@stripe');
    expect(postmcpObj.fieldMasks['/v1/refunds']).toEqual(['id', 'amount', 'status']);
  });

  it('POST /api/persist should save postmcp.config.json to the workspace disk respecting POSTMCP_WORKSPACE', async () => {
    const tempDir = os.tmpdir();
    process.env.POSTMCP_WORKSPACE = tempDir;

    const testConfig = {
      spec: '@stripe',
      tokenDiet: { enabled: true, maxTokens: 2500 },
      fieldMasks: { '/v1/refunds': ['id', 'amount'] },
    };

    const req = new Request('http://localhost:3000/api/persist', {
      method: 'POST',
      body: JSON.stringify(testConfig),
    });

    const res = await persistHandler(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    const savedFile = path.join(tempDir, 'postmcp.config.json');
    expect(fs.existsSync(savedFile)).toBe(true);

    const readConfig = JSON.parse(fs.readFileSync(savedFile, 'utf-8'));
    expect(readConfig.spec).toBe('@stripe');

    // Clean up
    fs.unlinkSync(savedFile);
    delete process.env.POSTMCP_WORKSPACE;
  });

  it('POST /api/sandbox should enforce dry-run safeguard on destructive mutations and apply Token Diet', async () => {
    const mockSpec = {
      title: 'Stripe API',
      operations: [
        {
          id: 'createRefund',
          summary: 'Create Refund',
          description: 'Refunds a charge',
          method: 'post',
          path: '/v1/refunds',
          riskTier: 'MUTATION',
          parameters: [{ name: 'charge_id', in: 'body', required: true, schema: { type: 'string' } }],
          inputSchema: { type: 'object', properties: { charge_id: { type: 'string' } } },
        },
      ],
    };

    const req = new Request('http://localhost:3000/api/sandbox', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Refund charge ch_12345' }],
        spec: mockSpec,
        selectedOperationId: 'createRefund',
        dryRun: true,
      }),
    });

    const res = await sandboxHandler(req);
    const data = await res.json();

    expect(data.content).toBeDefined();
    expect(data.toolCall?.name).toBe('createRefund');
    expect(data.result?.text).toContain('DRY RUN SAFEGUARD ACTIVE');
  });
});
