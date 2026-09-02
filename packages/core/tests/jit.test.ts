import { describe, it, expect } from 'vitest';
import { BM25ToolIndex } from '../src/jit/indexer.js';
import { ToolRegistry } from '../src/jit/registry.js';
import { NormalizedOperation } from '../src/parser/types.js';

describe('JIT Dynamic Tool Router', () => {
  const operations: NormalizedOperation[] = [
    {
      id: 'createRefund',
      method: 'post',
      path: '/v1/refunds',
      summary: 'Refund a payment or charge',
      description: 'Creates a new refund for an existing transaction',
      tags: ['billing'],
      parameters: [{ name: 'charge_id', in: 'body', required: true, schema: { type: 'string' } }],
      inputSchema: { type: 'object' },
      riskTier: 'CRITICAL',
    },
    {
      id: 'listInvoices',
      method: 'get',
      path: '/v1/invoices',
      summary: 'List all customer invoices',
      description: 'Returns a list of invoices for a customer',
      tags: ['billing'],
      parameters: [],
      inputSchema: { type: 'object' },
      riskTier: 'READ_ONLY',
    },
    {
      id: 'createUser',
      method: 'post',
      path: '/v1/users',
      summary: 'Create a new user account',
      description: 'Registers a new user in the organization',
      tags: ['users'],
      parameters: [{ name: 'email', in: 'body', required: true, schema: { type: 'string' } }],
      inputSchema: { type: 'object' },
      riskTier: 'MUTATION',
    },
  ];

  it('should rank relevant operations accurately using BM25 index', () => {
    const index = new BM25ToolIndex(operations);
    const results = index.search('refund payment transaction');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('createRefund');
  });

  it('should prevent access to unmounted operations in JIT mode (Finding 1)', () => {
    const registry = new ToolRegistry(operations, true); // Force JIT mode
    expect(registry.getIsJIT()).toBe(true);

    // Unmounted tool cannot be retrieved directly (prevents guessing bypass)
    expect(registry.getOperation('createRefund')).toBeUndefined();

    // Mount tool
    registry.mountToolsByQuery('refund');
    expect(registry.getOperation('createRefund')).toBeDefined();

    // Unmount tool
    registry.unmountTool('createRefund');
    expect(registry.getOperation('createRefund')).toBeUndefined();
  });

  it('should enforce LRU capacity eviction and reset mechanism (Finding 1)', () => {
    const registry = new ToolRegistry(operations, { forceJIT: true, maxMountedTools: 2 });

    registry.mountToolsByQuery('refund');
    registry.mountToolsByQuery('invoice');
    expect(registry.getActiveOperations().length).toBe(2);

    // Mount 3rd tool -> should evict the oldest
    registry.mountToolsByQuery('user');
    expect(registry.getActiveOperations().length).toBe(2);
    expect(registry.getOperation('createRefund')).toBeUndefined(); // evicted
    expect(registry.getOperation('createUser')).toBeDefined();

    // Reset
    registry.resetActiveTools();
    expect(registry.getActiveOperations().length).toBe(0);
  });

  it('should promote accessed tools in LRU order upon retrieval and evict least recently used', () => {
    const registry = new ToolRegistry(operations, { forceJIT: true, maxMountedTools: 2 });

    registry.mountToolsByQuery('refund'); // mounts createRefund
    registry.mountToolsByQuery('invoice'); // mounts listInvoices
    expect(registry.getActiveOperations().map((o) => o.id)).toEqual(['createRefund', 'listInvoices']);

    // Access createRefund -> promotes createRefund to MRU
    const op = registry.getOperation('createRefund');
    expect(op).toBeDefined();

    // Now mount createUser -> should evict listInvoices (since createRefund was recently accessed)
    registry.mountToolsByQuery('user');
    expect(registry.getActiveOperations().length).toBe(2);
    expect(registry.isOperationMounted('createRefund')).toBe(true);
    expect(registry.isOperationMounted('listInvoices')).toBe(false); // listInvoices was evicted!
    expect(registry.isOperationMounted('createUser')).toBe(true);
  });

  it('should preserve top-ranked search results when search returns more matches than capacity', () => {
    const registry = new ToolRegistry(operations, { forceJIT: true, maxMountedTools: 2 });

    // Search query matches multiple tools (createRefund, listInvoices, createUser)
    const mounted = registry.mountToolsByQuery('account user refund invoice', undefined, 5);

    // Should mount and return at most 2 tools, and they must be active
    expect(mounted.length).toBeLessThanOrEqual(2);
    expect(registry.getActiveOperations().length).toBe(2);
    for (const m of mounted) {
      expect(registry.isOperationMounted(m.id)).toBe(true);
    }
  });
});
