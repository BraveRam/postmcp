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

  it('should dynamically mount matched tools in ToolRegistry', () => {
    const registry = new ToolRegistry(operations, true); // Force JIT mode
    expect(registry.getIsJIT()).toBe(true);
    expect(registry.getActiveOperations().length).toBe(0);

    const mounted = registry.mountToolsByQuery('invoice');
    expect(mounted.length).toBe(1);
    expect(mounted[0].id).toBe('listInvoices');
    expect(registry.getActiveOperations().length).toBe(1);
  });
});
