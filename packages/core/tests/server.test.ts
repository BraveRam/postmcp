import { describe, it, expect } from 'vitest';
import { PostMcpServer } from '../src/server/runtime.js';
import { startHttpServer } from '../src/server/http.js';
import { NormalizedSpec } from '../src/parser/types.js';
import * as http from 'node:http';

describe('PostMcpServer MCP Protocol Conformance', () => {
  const sampleSpec: NormalizedSpec = {
    title: 'Test Service',
    version: '1.0.0',
    servers: [{ url: 'https://api.example.com' }],
    operations: [
      {
        id: 'listItems',
        method: 'get',
        path: '/items',
        summary: 'List items',
        description: 'Returns items',
        tags: ['items'],
        parameters: [],
        inputSchema: { type: 'object' },
        riskTier: 'READ_ONLY',
      },
      {
        id: 'deleteItem',
        method: 'delete',
        path: '/items/{id}',
        summary: 'Delete item',
        description: 'Permanent delete',
        tags: ['items'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            reason: { type: 'string' },
          },
          required: ['id'],
        },
        riskTier: 'CRITICAL',
      },
    ],
    securitySchemes: {},
    macros: [
      {
        name: 'cleanupWorkflow',
        description: 'Deletes all items',
        parameters: { type: 'object' },
        steps: [{ id: 'step1', action: 'DELETE /items/123' }],
      },
    ],
  };

  it('should emit safety annotations under the annotations object (Finding 4)', async () => {
    const postServer = new PostMcpServer({ spec: sampleSpec, jit: false });
    const mcpServer = postServer.getServerInstance();

    // Trigger ListToolsRequest handler
    const listHandler = (mcpServer as any)._requestHandlers?.get('tools/list');
    expect(listHandler).toBeDefined();

    const result = await listHandler({ method: 'tools/list', params: {} });
    expect(result.tools).toBeDefined();
    // 2 operations + 1 macro
    expect(result.tools.length).toBe(3);

    const deleteTool = result.tools.find((t: any) => t.name === 'deleteItem');
    expect(deleteTool).toBeDefined();
    // Safety annotations must be nested under annotations
    expect(deleteTool.annotations).toBeDefined();
    expect(deleteTool.annotations.destructiveHint).toBe(true);
    expect(deleteTool.annotations.readOnlyHint).toBe(false);

    const listTool = result.tools.find((t: any) => t.name === 'listItems');
    expect(listTool.annotations.readOnlyHint).toBe(true);
    expect(listTool.annotations.destructiveHint).toBe(false);

    const macroTool = result.tools.find((t: any) => t.name === 'macro_cleanupWorkflow');
    expect(macroTool.annotations).toBeDefined();
    expect(macroTool.annotations.destructiveHint).toBe(true);
  });

  it('should support JIT tool_search meta-tool and block unmounted calls (Finding 1)', async () => {
    const postServer = new PostMcpServer({ spec: sampleSpec, jit: true });
    const mcpServer = postServer.getServerInstance();

    const listHandler = (mcpServer as any)._requestHandlers?.get('tools/list');
    const callHandler = (mcpServer as any)._requestHandlers?.get('tools/call');

    // List tools in JIT mode -> tool_search + macro are advertised
    const listResult = await listHandler({ method: 'tools/list', params: {} });
    expect(listResult.tools.some((t: any) => t.name === 'tool_search')).toBe(true);

    // Trying to call deleteItem directly before mounting -> should return error
    const directCallResult = await callHandler({
      method: 'tools/call',
      params: { name: 'deleteItem', arguments: { id: '123' } },
    });
    expect(directCallResult.isError).toBe(true);
    expect(directCallResult.content[0].text).toContain('is not currently mounted');

    // Mount tool via tool_search
    const searchCallResult = await callHandler({
      method: 'tools/call',
      params: { name: 'tool_search', arguments: { query: 'delete item' } },
    });
    expect(searchCallResult.content[0].text).toContain('deleteItem');
    expect(searchCallResult.content[0].text).toContain('Mounted');

    // Now deleteItem is mounted and accessible
    const postSearchList = await listHandler({ method: 'tools/list', params: {} });
    expect(postSearchList.tools.some((t: any) => t.name === 'deleteItem')).toBe(true);
  });

  it('should generate dry-run simulations and support DELETE request bodies', async () => {
    const postServer = new PostMcpServer({ spec: sampleSpec, jit: false, dryRun: true });
    const mcpServer = postServer.getServerInstance();
    const callHandler = (mcpServer as any)._requestHandlers?.get('tools/call');

    const dryRunResult = await callHandler({
      method: 'tools/call',
      params: { name: 'deleteItem', arguments: { id: 'item_999', reason: 'Audit cleanup' } },
    });

    expect(dryRunResult.isError).toBeFalsy();
    const simJson = JSON.parse(dryRunResult.content[0].text);
    expect(simJson.isDryRun).toBe(true);
    expect(simJson.method).toBe('DELETE');
    expect(simJson.targetUrl).toBe('https://api.example.com/items/item_999');
    expect(simJson.body).toEqual({ reason: 'Audit cleanup' });
  });

  it('should initialize Streamable HTTP server with StreamableHTTPServerTransport', async () => {
    const { httpServer, url } = await startHttpServer({
      spec: sampleSpec,
      port: 0, // OS assigned random port
      endpointPath: '/mcp',
    });

    try {
      expect(url).toContain('/mcp');

      // Test OPTIONS request (CORS)
      const port = (httpServer.address() as any).port;
      const optionsRes = await new Promise<http.IncomingMessage>((resolve, reject) => {
        const req = http.request(
          {
            hostname: 'localhost',
            port,
            path: '/mcp',
            method: 'OPTIONS',
          },
          (res) => resolve(res)
        );
        req.on('error', reject);
        req.end();
      });

      expect(optionsRes.statusCode).toBe(204);
      expect(optionsRes.headers['access-control-allow-origin']).toBe('*');

      // Test POST JSON-RPC initialize request
      const initBody = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      });

      const initResData = await new Promise<string>((resolve, reject) => {
        const req = http.request(
          {
            hostname: 'localhost',
            port,
            path: '/mcp',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(initBody),
              Accept: 'application/json, text/event-stream',
            },
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => resolve(data));
          }
        );
        req.on('error', reject);
        req.write(initBody);
        req.end();
      });

      expect(initResData).toContain('serverInfo');
      expect(initResData).toContain('Test Service');
    } finally {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });
});
