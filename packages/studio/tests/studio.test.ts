import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { GET as getPresetsHandler } from '../src/app/api/presets/route.js';
import { POST as parseHandler } from '../src/app/api/parse/route.js';
import { POST as tokenDietHandler } from '../src/app/api/token-diet/route.js';
import { POST as exportHandler } from '../src/app/api/export/route.js';
import { POST as persistHandler } from '../src/app/api/persist/route.js';
import { POST as sandboxHandler, isPrivateOrBlockedHost, resolveTargetAuthConfig } from '../src/app/api/sandbox/route.js';
import { GET as initialSpecHandler } from '../src/app/api/initial-spec/route.js';
import { GET as getEnvHandler, POST as postEnvHandler } from '../src/app/api/env/route.js';
import { getScopedEnvKey } from '../src/lib/env-scope.js';

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

  it('GET /api/presets should correctly filter by category with encoded and unencoded ampersands', async () => {
    // 1. Encoded category
    const req1 = new Request(`http://localhost:3000/api/presets?category=${encodeURIComponent('Payments & Commerce')}`);
    const res1 = await getPresetsHandler(req1);
    const data1 = await res1.json();
    expect(data1.presets.length).toBeGreaterThanOrEqual(8);
    expect(data1.presets.every((p: any) => p.category === 'Payments & Commerce')).toBe(true);
    expect(data1.presets.some((p: any) => p.id === 'stripe')).toBe(true);

    // 2. Unencoded category (e.g. ?category=Payments & Commerce&q=)
    const req2 = new Request('http://localhost:3000/api/presets?category=Payments & Commerce&q=');
    const res2 = await getPresetsHandler(req2);
    const data2 = await res2.json();
    expect(data2.presets.length).toBeGreaterThanOrEqual(8);
    expect(data2.presets.some((p: any) => p.id === 'shopify')).toBe(true);

    // 3. Database & Cloud
    const req3 = new Request(`http://localhost:3000/api/presets?category=${encodeURIComponent('Database & Cloud')}`);
    const res3 = await getPresetsHandler(req3);
    const data3 = await res3.json();
    expect(data3.presets.length).toBeGreaterThanOrEqual(7);
    expect(data3.presets.some((p: any) => p.id === 'supabase')).toBe(true);
    expect(data3.presets.some((p: any) => p.id === 'neon')).toBe(true);
  });

  it('GET /api/initial-spec should return runtime initial spec environment variable', async () => {
    process.env.STUDIO_INITIAL_SPEC = '@linear';
    const res = await initialSpecHandler();
    const data = await res.json();

    expect(data.initialSpec).toBe('@linear');
    delete process.env.STUDIO_INITIAL_SPEC;
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

  it('SSRF Safeguard should block private and loopback hosts', () => {
    expect(isPrivateOrBlockedHost('http://localhost:8080/api')).toBe(true);
    expect(isPrivateOrBlockedHost('http://127.0.0.1:3000/secret')).toBe(true);
    expect(isPrivateOrBlockedHost('http://169.254.169.254/latest/meta-data')).toBe(true);
    expect(isPrivateOrBlockedHost('http://192.168.1.1/admin')).toBe(true);
    expect(isPrivateOrBlockedHost('http://10.0.0.1/internal')).toBe(true);
    expect(isPrivateOrBlockedHost('https://api.stripe.com/v1/charges')).toBe(false);
    expect(isPrivateOrBlockedHost('https://api.github.com/user')).toBe(false);
  });

  it('resolveTargetAuthConfig should correctly inject bearer token and custom headers', () => {
    // 1. Explicit Bearer token
    const res1 = resolveTargetAuthConfig({ bearerToken: 'fc-test-key-12345' });
    expect(res1.bearerToken).toBe('fc-test-key-12345');
    expect(res1.headers['Authorization']).toBe('Bearer fc-test-key-12345');

    // 2. Custom headers as array
    const res2 = resolveTargetAuthConfig({
      bearerToken: 'token_abc',
      customFields: [
        { key: 'X-Api-Key', value: 'custom_val' },
        { key: 'X-Org-Id', value: 'org_999' },
      ],
    });
    expect(res2.headers['Authorization']).toBe('Bearer token_abc');
    expect(res2.headers['X-Api-Key']).toBe('custom_val');
    expect(res2.headers['X-Org-Id']).toBe('org_999');

    // 3. Custom headers as record object
    const res3 = resolveTargetAuthConfig({
      customFields: {
        'X-Client-Id': 'client_123',
      },
    });
    expect(res3.headers['X-Client-Id']).toBe('client_123');
  });

  it('resolveTargetAuthConfig should auto-resolve from environment variables based on spec title/url', () => {
    process.env.FIRECRAWL_API_KEY = 'fc-env-secret-999';
    const firecrawlSpec: any = { title: 'Firecrawl API', servers: [{ url: 'https://api.firecrawl.dev' }] };
    const res = resolveTargetAuthConfig(undefined, firecrawlSpec);

    expect(res.bearerToken).toBe('fc-env-secret-999');
    expect(res.headers['Authorization']).toBe('Bearer fc-env-secret-999');
    delete process.env.FIRECRAWL_API_KEY;
  });

  it('POST /api/sandbox should accept authConfig with custom headers and never leak tokens to LLM output', async () => {
    const mockSpec: any = {
      title: 'Firecrawl API',
      servers: [{ url: 'https://api.firecrawl.dev' }],
      operations: [
        {
          id: 'scrape',
          summary: 'Scrape Web Page',
          description: 'Extract clean markdown and content from URL',
          method: 'post',
          path: '/v1/scrape',
          riskTier: 'MUTATION',
          parameters: [{ name: 'url', in: 'body', required: true, schema: { type: 'string' } }],
          inputSchema: { type: 'object', properties: { url: { type: 'string' } } },
        },
      ],
    };

    const secretKey = 'fc-super-secret-token-xyz';
    const req = new Request('http://localhost:3000/api/sandbox', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Scrape https://example.com' }],
        spec: mockSpec,
        selectedOperationId: 'scrape',
        dryRun: true,
        authConfig: {
          bearerToken: secretKey,
          customFields: [{ key: 'X-Tenant-Id', value: 'tenant-abc' }],
        },
      }),
    });

    const res = await sandboxHandler(req);
    const data = await res.json();

    expect(data.content).toBeDefined();
    expect(data.toolCall?.name).toBe('scrape');
    // Ensure the secret key is never leaked into the model output or response text
    expect(data.content).not.toContain(secretKey);
    if (data.result?.text) {
      expect(data.result.text).not.toContain(secretKey);
    }
  });

  it('POST /api/sandbox should support stream: true and return text/event-stream with tool events and text deltas', async () => {
    const mockSpec: any = {
      title: 'Scrape API',
      servers: [{ url: 'https://api.example.com' }],
      operations: [
        {
          id: 'scrapeUrl',
          summary: 'Scrape a single URL',
          method: 'post',
          path: '/v1/scrape',
          riskTier: 'MUTATION',
          inputSchema: {
            type: 'object',
            properties: {
              url: { type: 'string' },
            },
            required: ['url'],
          },
        },
      ],
    };

    const req = new Request('http://localhost:3000/api/sandbox', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Scrape https://pullora.chat' }],
        spec: mockSpec,
        selectedOperationId: 'scrapeUrl',
        dryRun: true,
        stream: true,
      }),
    });

    const res = await sandboxHandler(req);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const reader = res.body?.getReader();
    expect(reader).toBeDefined();

    const decoder = new TextDecoder();
    let fullOutput = '';
    const events: any[] = [];

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;
      fullOutput += decoder.decode(value, { stream: true });
      const lines = fullOutput.split('\n');
      fullOutput = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const raw = line.slice(6).trim();
          if (raw && raw !== '[DONE]') {
            events.push(JSON.parse(raw));
          }
        }
      }
    }

    expect(events.length).toBeGreaterThan(0);
    const toolCallEvent = events.find((e) => e.type === 'tool-call');
    expect(toolCallEvent).toBeDefined();
    expect(toolCallEvent.name).toBe('scrapeUrl');

    const toolResultEvent = events.find((e) => e.type === 'tool-result');
    expect(toolResultEvent).toBeDefined();
    expect(toolResultEvent.name).toBe('scrapeUrl');

    const textDeltaEvent = events.find((e) => e.type === 'text-delta');
    expect(textDeltaEvent).toBeDefined();

    const doneEvent = events.find((e) => e.type === 'done');
    expect(doneEvent).toBeDefined();
  });

  it('getToolLabel should humanize camelCase, snake_case, and kebab-case operation names into natural titles', async () => {
    const { getToolLabel } = await import('../src/components/ai-elements/tool.js');

    expect(getToolLabel('scrapeAndExtractFromUrl')).toBe('Scrape And Extract From Url');
    expect(getToolLabel('assignment_edit_references')).toBe('Assignment Edit References');
    expect(getToolLabel('billing_balance')).toBe('Billing Balance');
    expect(getToolLabel('create-checkout-session')).toBe('Create Checkout Session');
    expect(getToolLabel('listAllProjects')).toBe('List All Projects');
  });

  it('POST /api/sandbox should preserve input parameters and non-empty output in tool results for composite schemas', async () => {
    const firecrawlLikeSpec: any = {
      title: 'Firecrawl Like API',
      servers: [{ url: 'https://api.example.com' }],
      operations: [
        {
          id: 'scrapeAndExtractFromUrl',
          summary: 'Scrape a single URL',
          method: 'post',
          path: '/v1/scrape',
          riskTier: 'MUTATION',
          parameters: [],
          inputSchema: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'Target URL' },
            },
            required: ['url'],
          },
        },
      ],
    };

    const req = new Request('http://localhost:3000/api/sandbox', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Scrape https://pullora.chat' }],
        spec: firecrawlLikeSpec,
        selectedOperationId: 'scrapeAndExtractFromUrl',
        dryRun: true,
        stream: true,
      }),
    });

    const res = await sandboxHandler(req);
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let fullOutput = '';
    const events: any[] = [];

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;
      fullOutput += decoder.decode(value, { stream: true });
      const lines = fullOutput.split('\n');
      fullOutput = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const raw = line.slice(6).trim();
          if (raw && raw !== '[DONE]') {
            events.push(JSON.parse(raw));
          }
        }
      }
    }

    const toolCall = events.find((e) => e.type === 'tool-call');
    expect(toolCall).toBeDefined();
    expect(toolCall.args).toBeDefined();
    expect(toolCall.args.url).toBe('https://pullora.chat');

    const toolResult = events.find((e) => e.type === 'tool-result');
    expect(toolResult).toBeDefined();
    expect(toolResult.args).toBeDefined();
    expect(toolResult.args.url).toBe('https://pullora.chat');
    expect(toolResult.result.text).toBeDefined();
    expect(toolResult.result.text.length).toBeGreaterThan(0);
  });

  it('Markdown component should render formatted headers, lists, code blocks, and links', async () => {
    const React = await import('react');
    const { renderToString } = await import('react-dom/server');
    const { Markdown } = await import('../src/components/Markdown.js');

    const markdownText = `# Studio Title\n\nHere is a [link](https://postmcp.dev) and \`inline_code\`.\n\n- Bullet 1\n- Bullet 2\n\n\`\`\`json\n{"status": "ok"}\n\`\`\``;
    const html = renderToString(React.createElement(Markdown, { children: markdownText }));

    expect(html).toContain('<h1');
    expect(html).toContain('Studio Title');
    expect(html).toContain('<a href="https://postmcp.dev"');
    expect(html).toContain('<code');
    expect(html).toContain('inline_code');
    expect(html).toContain('<ul');
    expect(html).toContain('<li');
    expect(html).toContain('Bullet 1');
    expect(html).toContain('<pre');
  });

  it('LiveSandboxModal should export component and accept modal configuration props', async () => {
    const { LiveSandboxModal } = await import('../src/components/LiveSandboxModal.js');
    expect(LiveSandboxModal).toBeDefined();
    expect(typeof LiveSandboxModal).toBe('function');
  });

  it('User messages should render plain text without markdown conversion', async () => {
    const React = await import('react');
    const { renderToString } = await import('react-dom/server');
    const { MessageResponse } = await import('../src/components/ai-elements/message.js');

    const rawText = '# Not A Header\n**not bold**';
    const userHtml = renderToString(React.createElement(MessageResponse, { from: 'user' }, rawText));
    expect(userHtml).not.toContain('<h1');
    expect(userHtml).not.toContain('<strong');
    expect(userHtml).toContain('# Not A Header');
    expect(userHtml).toContain('whitespace-pre-wrap');

    const assistantHtml = renderToString(React.createElement(MessageResponse, { from: 'assistant' }, rawText));
    expect(assistantHtml).toContain('<h1');
    expect(assistantHtml).toContain('<strong');
  });

  it('Streaming sandbox endpoint should emit matching toolCallId on tool-call and tool-result events', async () => {
    const mockSpec: any = {
      title: 'Test Spec',
      operations: [
        {
          id: 'testOp',
          summary: 'Test Operation',
          method: 'get',
          path: '/test',
          riskTier: 'READ_ONLY',
        },
      ],
    };

    const req = new Request('http://localhost:3000/api/sandbox', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'test' }],
        spec: mockSpec,
        selectedOperationId: 'testOp',
        dryRun: false,
        stream: true,
      }),
    });

    const res = await sandboxHandler(req);
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let fullOutput = '';
    const events: any[] = [];

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;
      fullOutput += decoder.decode(value, { stream: true });
      const lines = fullOutput.split('\n');
      fullOutput = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const raw = line.slice(6).trim();
          if (raw && raw !== '[DONE]') {
            events.push(JSON.parse(raw));
          }
        }
      }
    }

    const toolCall = events.find((e) => e.type === 'tool-call');
    const toolResult = events.find((e) => e.type === 'tool-result');

    expect(toolCall).toBeDefined();
    expect(toolResult).toBeDefined();
    expect(toolCall.toolCallId).toBeDefined();
    expect(toolResult.toolCallId).toBeDefined();
    expect(toolCall.toolCallId).toBe(toolResult.toolCallId);
    expect(toolResult.result.text).toBeDefined();
  });

  it('getScopedEnvKey should accurately map well-known services and sanitize custom titles', () => {
    expect(getScopedEnvKey('Firecrawl API', 'https://api.firecrawl.dev')).toBe('FIRECRAWL_API_KEY');
    expect(getScopedEnvKey('Stripe API', 'https://api.stripe.com')).toBe('STRIPE_SECRET_KEY');
    expect(getScopedEnvKey('GitHub REST API', 'https://api.github.com')).toBe('GITHUB_TOKEN');
    expect(getScopedEnvKey('Neon Console API', 'https://console.neon.tech/api/v2')).toBe('NEON_API_KEY');
    expect(getScopedEnvKey('My Weather Service', 'https://weather.example.com')).toBe('MY_WEATHER_API_KEY');
    expect(getScopedEnvKey(undefined, 'https://sub.mycorp.io/api')).toBe('MYCORP_API_KEY');
    expect(getScopedEnvKey(undefined, undefined)).toBe('BEARER_TOKEN');
  });

  it('GET /api/env and POST /api/env should persist and inspect scoped credentials in workspace .env', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'postmcp-env-test-'));
    process.env.POSTMCP_WORKSPACE = tmpDir;

    try {
      // 1. Initially check - should not exist
      const checkReq1 = new Request('http://localhost:3000/api/env?specTitle=CustomTestAPI');
      const checkRes1 = await getEnvHandler(checkReq1);
      const checkData1 = await checkRes1.json();
      expect(checkData1.exists).toBe(false);
      expect(checkData1.envVarName).toBe('CUSTOM_TEST_API_KEY');

      // 2. Save token and custom header via POST
      const postReq = new Request('http://localhost:3000/api/env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specTitle: 'CustomTestAPI',
          token: 'sec_test_secret_value_12345',
          customHeaders: [{ key: 'X-App-Id', val: 'app_999' }],
        }),
      });
      const postRes = await postEnvHandler(postReq);
      const postData = await postRes.json();
      expect(postData.success).toBe(true);
      expect(postData.updatedKeys).toContain('CUSTOM_TEST_API_KEY');
      expect(postData.updatedKeys).toContain('CUSTOM_TEST_HEADER_X_APP_ID');

      // Verify file written to tmpDir
      const envPath = path.join(tmpDir, '.env');
      expect(fs.existsSync(envPath)).toBe(true);
      const fileContent = fs.readFileSync(envPath, 'utf-8');
      expect(fileContent).toContain('CUSTOM_TEST_API_KEY="sec_test_secret_value_12345"');
      expect(fileContent).toContain('CUSTOM_TEST_HEADER_X_APP_ID="app_999"');

      // 3. Query GET again - should now report exists with value and custom headers
      const checkReq2 = new Request('http://localhost:3000/api/env?specTitle=CustomTestAPI');
      const checkRes2 = await getEnvHandler(checkReq2);
      const checkData2 = await checkRes2.json();
      expect(checkData2.exists).toBe(true);
      expect(checkData2.hasValue).toBe(true);
      expect(checkData2.value).toBe('sec_test_secret_value_12345');
      expect(checkData2.maskedValue).toContain('sec_...2345');
      expect(checkData2.customHeaders).toEqual([{ key: 'X-APP-ID', val: 'app_999' }]);

      // 4. Query another API (e.g. OtherService) - must be completely isolated and not return CustomTestAPI's key
      const otherReq = new Request('http://localhost:3000/api/env?specTitle=OtherService');
      const otherRes = await getEnvHandler(otherReq);
      const otherData = await otherRes.json();
      expect(otherData.envVarName).toBe('OTHER_API_KEY');
      expect(otherData.exists).toBe(false);
      expect(otherData.hasValue).toBe(false);
      expect(otherData.value).toBe('');
      expect(otherData.customHeaders).toEqual([]);
    } finally {
      delete process.env.POSTMCP_WORKSPACE;
      delete process.env.CUSTOM_TEST_API_KEY;
      delete process.env.CUSTOM_TEST_HEADER_X_APP_ID;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

