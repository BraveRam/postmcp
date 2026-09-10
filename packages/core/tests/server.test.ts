import { describe, it, expect } from 'vitest';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { Tool, CallToolResult, TextContent } from '@modelcontextprotocol/sdk/types.js';
import { PostMcpServer, DEFAULT_POSTMCP_INSTRUCTIONS } from '../src/server/runtime.js';
import { startHttpServer } from '../src/server/http.js';
import { NormalizedSpec } from '../src/parser/types.js';
import type { ToolAnnotations } from '../src/safety/classifier.js';
import type { HttpRequestConfig, HttpResponseResult } from '../src/http/client.js';

type RequestHandler<TReq = Record<string, unknown>, TRes = unknown> = (request: TReq) => Promise<TRes>;

function getMcpHandler<TRes = unknown, TReq = Record<string, unknown>>(
  server: Server,
  method: string
): RequestHandler<TReq, TRes> {
  const handler = (
    server as Server & {
      _requestHandlers?: Map<string, RequestHandler<TReq, TRes>>;
    }
  )._requestHandlers?.get(method);
  if (!handler) {
    throw new Error(`Handler for ${method} not found`);
  }
  return handler;
}

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
    const listHandler = getMcpHandler<{ tools: Tool[] }>(mcpServer, 'tools/list');
    expect(listHandler).toBeDefined();

    const result = await listHandler({ method: 'tools/list', params: {} });
    expect(result.tools).toBeDefined();
    // 2 operations + 1 macro
    expect(result.tools.length).toBe(3);

    const deleteTool = result.tools.find((t) => t.name === 'deleteItem');
    expect(deleteTool).toBeDefined();
    // Safety annotations must be nested under annotations
    const deleteAnnotations = deleteTool?.annotations as ToolAnnotations | undefined;
    expect(deleteAnnotations).toBeDefined();
    expect(deleteAnnotations?.destructiveHint).toBe(true);
    expect(deleteAnnotations?.readOnlyHint).toBe(false);

    const listTool = result.tools.find((t) => t.name === 'listItems');
    const listAnnotations = listTool?.annotations as ToolAnnotations | undefined;
    expect(listAnnotations?.readOnlyHint).toBe(true);
    expect(listAnnotations?.destructiveHint).toBe(false);

    const macroTool = result.tools.find((t) => t.name === 'macro_cleanupWorkflow');
    const macroAnnotations = macroTool?.annotations as ToolAnnotations | undefined;
    expect(macroAnnotations).toBeDefined();
    expect(macroAnnotations?.destructiveHint).toBe(true);
  });

  it('should support JIT tool_search meta-tool and block unmounted calls (Finding 1)', async () => {
    const postServer = new PostMcpServer({ spec: sampleSpec, jit: true });
    const mcpServer = postServer.getServerInstance();

    const listHandler = getMcpHandler<{ tools: Tool[] }>(mcpServer, 'tools/list');
    const callHandler = getMcpHandler<CallToolResult>(mcpServer, 'tools/call');

    // List tools in JIT mode -> tool_search + macro are advertised
    const listResult = await listHandler({ method: 'tools/list', params: {} });
    expect(listResult.tools.some((t) => t.name === 'tool_search')).toBe(true);

    // Trying to call deleteItem directly before mounting -> should return error
    const directCallResult = await callHandler({
      method: 'tools/call',
      params: { name: 'deleteItem', arguments: { id: '123' } },
    });
    expect(directCallResult.isError).toBe(true);
    const directContent = directCallResult.content[0] as TextContent;
    expect(directContent.text).toContain('is not currently mounted');

    // Mount tool via tool_search
    const searchCallResult = await callHandler({
      method: 'tools/call',
      params: { name: 'tool_search', arguments: { query: 'delete item' } },
    });
    const searchContent = searchCallResult.content[0] as TextContent;
    expect(searchContent.text).toContain('deleteItem');
    expect(searchContent.text).toContain('Mounted');

    // Now deleteItem is mounted and accessible
    const postSearchList = await listHandler({ method: 'tools/list', params: {} });
    expect(postSearchList.tools.some((t) => t.name === 'deleteItem')).toBe(true);
  });

  it('should generate dry-run simulations and support DELETE request bodies', async () => {
    const postServer = new PostMcpServer({ spec: sampleSpec, jit: false, dryRun: true });
    const mcpServer = postServer.getServerInstance();
    const callHandler = getMcpHandler<CallToolResult>(mcpServer, 'tools/call');

    const dryRunResult = await callHandler({
      method: 'tools/call',
      params: { name: 'deleteItem', arguments: { id: 'item_999', reason: 'Audit cleanup' } },
    });

    expect(dryRunResult.isError).toBeFalsy();
    const resultContent = dryRunResult.content[0] as TextContent;
    const simJson = JSON.parse(resultContent.text);
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
      const port = (httpServer.address() as AddressInfo).port;
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

  it('should auto-inject tenant ID from environment when omitted or passed dummy value', async () => {
    process.env.NEON_ORG_ID = 'org-auto-12345';

    const tenantSpec: NormalizedSpec = {
      title: 'Tenant Service',
      version: '1.0.0',
      servers: [{ url: 'https://api.example.com' }],
      operations: [
        {
          id: 'listProjects',
          method: 'get',
          path: '/projects',
          summary: 'List projects',
          parameters: [
            { name: 'org_id', in: 'query', schema: { type: 'string' } },
          ],
          inputSchema: {
            type: 'object',
            properties: {
              org_id: { type: 'string' },
            },
          },
          riskTier: 'READ_ONLY',
        },
      ],
      securitySchemes: {},
    };

    const postServer = new PostMcpServer({ spec: tenantSpec, jit: false });
    let capturedParams: Record<string, unknown> | undefined;
    postServer.getHttpClient().request = async (options: HttpRequestConfig): Promise<HttpResponseResult> => {
      capturedParams = options.params as Record<string, unknown> | undefined;
      return {
        isError: false,
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { projects: [{ id: 'proj_1', name: 'Alpha' }] },
      };
    };

    const mcpServer = postServer.getServerInstance();
    const callHandler = getMcpHandler<CallToolResult>(mcpServer, 'tools/call');

    // Case A: omitted org_id
    const resA = await callHandler({
      method: 'tools/call',
      params: { name: 'listProjects', arguments: {} },
    });
    expect(resA.isError).toBeFalsy();
    expect(capturedParams?.org_id).toBe('org-auto-12345');

    // Case B: dummy org-unknown
    const resB = await callHandler({
      method: 'tools/call',
      params: { name: 'listProjects', arguments: { org_id: 'org-unknown' } },
    });
    expect(resB.isError).toBeFalsy();
    expect(capturedParams?.org_id).toBe('org-auto-12345');

    delete process.env.NEON_ORG_ID;
  });

  it('should perform multi-tenant fallback when primary organization returns empty', async () => {
    const multiTenantSpec: NormalizedSpec = {
      title: 'Multi-Tenant Service',
      version: '1.0.0',
      servers: [{ url: 'https://api.example.com' }],
      operations: [
        {
          id: 'getOrganizations',
          method: 'get',
          path: '/users/me/organizations',
          summary: 'List user organizations',
          parameters: [],
          inputSchema: { type: 'object' },
          riskTier: 'READ_ONLY',
        },
        {
          id: 'listProjects',
          method: 'get',
          path: '/projects',
          summary: 'List projects',
          parameters: [
            { name: 'org_id', in: 'query', schema: { type: 'string' } },
          ],
          inputSchema: {
            type: 'object',
            properties: {
              org_id: { type: 'string' },
            },
          },
          riskTier: 'READ_ONLY',
        },
      ],
      securitySchemes: {},
    };

    const postServer = new PostMcpServer({ spec: multiTenantSpec, jit: false });
    postServer.getHttpClient().request = async (options: HttpRequestConfig): Promise<HttpResponseResult> => {
      if (options.url === '/users/me/organizations') {
        return {
          isError: false,
          status: 200,
          statusText: 'OK',
          headers: {},
          data: {
            organizations: [
              { id: 'org-empty-default' },
              { id: 'org-active-projects' },
            ],
          },
        };
      }
      if (options.url === '/projects') {
        const params = options.params as Record<string, unknown> | undefined;
        if (params?.org_id === 'org-empty-default') {
          return {
            isError: false,
            status: 200,
            statusText: 'OK',
            headers: {},
            data: { projects: [] },
          };
        }
        if (params?.org_id === 'org-active-projects') {
          return {
            isError: false,
            status: 200,
            statusText: 'OK',
            headers: {},
            data: {
              projects: [
                { id: 'proj_100', name: 'Real Project' },
              ],
            },
          };
        }
      }
      return { isError: true, status: 404, statusText: 'Not Found', headers: {}, data: null };
    };

    const mcpServer = postServer.getServerInstance();
    const callHandler = getMcpHandler<CallToolResult>(mcpServer, 'tools/call');

    const res = await callHandler({
      method: 'tools/call',
      params: { name: 'listProjects', arguments: {} },
    });

    expect(res.isError).toBeFalsy();
    const resContent = res.content[0] as TextContent;
    expect(resContent.text).toContain('Real Project');
  });

  it('should auto-paginate and consolidate up to 3 pages internally', async () => {
    const paginateSpec: NormalizedSpec = {
      title: 'Paginated Service',
      version: '1.0.0',
      servers: [{ url: 'https://api.example.com' }],
      operations: [
        {
          id: 'listProjects',
          method: 'get',
          path: '/projects',
          summary: 'List projects',
          parameters: [
            { name: 'cursor', in: 'query', schema: { type: 'string' } },
          ],
          inputSchema: { type: 'object' },
          riskTier: 'READ_ONLY',
        },
      ],
      securitySchemes: {},
    };

    const postServer = new PostMcpServer({ spec: paginateSpec, jit: false });
    postServer.getHttpClient().request = async (options: HttpRequestConfig): Promise<HttpResponseResult> => {
      const params = options.params as Record<string, unknown> | undefined;
      const cursor = params?.cursor;
      if (!cursor) {
        return {
          isError: false,
          status: 200,
          statusText: 'OK',
          headers: {},
          data: {
            projects: [{ id: 'p1', name: 'Project 1' }],
            pagination: { cursor: 'cursor-page-2' },
          },
        };
      }
      if (cursor === 'cursor-page-2') {
        return {
          isError: false,
          status: 200,
          statusText: 'OK',
          headers: {},
          data: {
            projects: [{ id: 'p2', name: 'Project 2' }],
            pagination: { cursor: 'cursor-page-3' },
          },
        };
      }
      if (cursor === 'cursor-page-3') {
        return {
          isError: false,
          status: 200,
          statusText: 'OK',
          headers: {},
          data: {
            projects: [{ id: 'p3', name: 'Project 3' }],
            pagination: { cursor: null },
          },
        };
      }
      return { isError: true, status: 500, statusText: 'Error', headers: {}, data: null };
    };

    const mcpServer = postServer.getServerInstance();
    const callHandler = getMcpHandler<CallToolResult>(mcpServer, 'tools/call');

    const res = await callHandler({
      method: 'tools/call',
      params: { name: 'listProjects', arguments: {} },
    });

    expect(res.isError).toBeFalsy();
    const pageContent = res.content[0] as TextContent;
    expect(pageContent.text).toContain('Project 1');
    expect(pageContent.text).toContain('Project 2');
    expect(pageContent.text).toContain('Project 3');
  });

  it('should include PostMCP Token Diet instructions in MCP server initialize response', async () => {
    const postServer = new PostMcpServer({ spec: sampleSpec });
    const mcpServer = postServer.getServerInstance();

    const initHandler = getMcpHandler<{ instructions?: string }>(mcpServer, 'initialize');
    expect(initHandler).toBeDefined();

    const res = await initHandler({
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-agent', version: '1.0.0' },
      },
    });

    expect(res.instructions).toBeDefined();
    expect(res.instructions).toContain('PostMCP Token Diet is active for this server');
    expect(res.instructions).toContain('compacted');
    expect(res.instructions).toContain('by design');
  });

  it('should combine custom server instructions with PostMCP Token Diet instructions', async () => {
    const postServer = new PostMcpServer({
      spec: sampleSpec,
      instructions: 'Always double check project IDs before deletion.',
    });
    const mcpServer = postServer.getServerInstance();

    const initHandler = getMcpHandler<{ instructions?: string }>(mcpServer, 'initialize');
    const res = await initHandler({
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-agent', version: '1.0.0' },
      },
    });

    expect(res.instructions).toContain(DEFAULT_POSTMCP_INSTRUCTIONS);
    expect(res.instructions).toContain('Always double check project IDs before deletion.');
  });

  it('should omit PostMCP instructions when tokenDiet is explicitly disabled', async () => {
    const postServer = new PostMcpServer({
      spec: sampleSpec,
      tokenDiet: { enabled: false },
    });
    const mcpServer = postServer.getServerInstance();

    const initHandler = getMcpHandler<{ instructions?: string }>(mcpServer, 'initialize');
    const res = await initHandler({
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-agent', version: '1.0.0' },
      },
    });

    expect(res.instructions).toBeUndefined();
  });
});
