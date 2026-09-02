import { describe, it, expect } from 'vitest';
import { PostMcpServer } from '../src/server/runtime.js';
import { NormalizedSpec } from '../src/parser/types.js';

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
        inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        riskTier: 'CRITICAL',
      },
    ],
    securitySchemes: {},
  };

  it('should emit safety annotations under the annotations object (Finding 4)', async () => {
    const postServer = new PostMcpServer({ spec: sampleSpec, jit: false });
    const mcpServer = postServer.getServerInstance();

    // Trigger ListToolsRequest handler
    const listHandler = (mcpServer as any)._requestHandlers?.get('tools/list');
    expect(listHandler).toBeDefined();

    const result = await listHandler({ method: 'tools/list', params: {} });
    expect(result.tools).toBeDefined();
    expect(result.tools.length).toBe(2);

    const deleteTool = result.tools.find((t: any) => t.name === 'deleteItem');
    expect(deleteTool).toBeDefined();
    // Safety annotations must be nested under annotations
    expect(deleteTool.annotations).toBeDefined();
    expect(deleteTool.annotations.destructiveHint).toBe(true);
    expect(deleteTool.annotations.readOnlyHint).toBe(false);

    const listTool = result.tools.find((t: any) => t.name === 'listItems');
    expect(listTool.annotations.readOnlyHint).toBe(true);
    expect(listTool.annotations.destructiveHint).toBe(false);
  });

  it('should support JIT tool_search meta-tool and block unmounted calls (Finding 1)', async () => {
    const postServer = new PostMcpServer({ spec: sampleSpec, jit: true });
    const mcpServer = postServer.getServerInstance();

    const listHandler = (mcpServer as any)._requestHandlers?.get('tools/list');
    const callHandler = (mcpServer as any)._requestHandlers?.get('tools/call');

    // List tools in JIT mode -> only tool_search is advertised
    const listResult = await listHandler({ method: 'tools/list', params: {} });
    expect(listResult.tools.length).toBe(1);
    expect(listResult.tools[0].name).toBe('tool_search');

    // Trying to call deleteItem directly before mounting -> should return error
    const directCallResult = await callHandler({
      method: 'tools/call',
      params: { name: 'deleteItem', arguments: { id: '123' } },
    });
    expect(directCallResult.isError).toBe(true);
    expect(directCallResult.content[0].text).toContain("is not currently mounted");

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
});
