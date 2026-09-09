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

  it('should pre-mount operations with x-hot-tool or x-priority: "high" vendor extensions', () => {
    const customOps: NormalizedOperation[] = [
      {
        id: 'getDeepNestedAnalytics',
        method: 'get',
        path: '/v1/internal/deep/analytics',
        summary: 'Deeply nested internal metric report',
        description: 'Returns internal usage metrics',
        tags: ['internal'],
        parameters: [],
        inputSchema: { type: 'object' },
        riskTier: 'READ_ONLY',
        extensions: { 'x-hot-tool': true },
      },
      {
        id: 'getGenericAudit',
        method: 'get',
        path: '/audit',
        summary: 'Audit log listing',
        description: 'Listing logs',
        tags: ['logs'],
        parameters: [],
        inputSchema: { type: 'object' },
        riskTier: 'READ_ONLY',
      },
    ];

    const registry = new ToolRegistry(customOps, { forceJIT: true, maxMountedTools: 5 });
    const active = registry.getActiveOperations();
    expect(active.map((o) => o.id)).toContain('getDeepNestedAnalytics');
  });

  it('should exclude operations with x-hot-tool: false from turn-1 hot tools', () => {
    const customOps: NormalizedOperation[] = [
      {
        id: 'listProjects',
        method: 'get',
        path: '/projects',
        summary: 'List projects',
        description: 'List all projects',
        tags: ['projects'],
        parameters: [],
        inputSchema: { type: 'object' },
        riskTier: 'READ_ONLY',
        extensions: { 'x-hot-tool': false },
      },
      {
        id: 'listDatabases',
        method: 'get',
        path: '/databases',
        summary: 'List databases',
        description: 'List all databases',
        tags: ['databases'],
        parameters: [],
        inputSchema: { type: 'object' },
        riskTier: 'READ_ONLY',
      },
    ];

    const registry = new ToolRegistry(customOps, { forceJIT: true, maxMountedTools: 5 });
    const active = registry.getActiveOperations();
    expect(active.map((o) => o.id)).not.toContain('listProjects');
    expect(active.map((o) => o.id)).toContain('listDatabases');
  });

  it('should prioritize user-configured hotToolKeywords over default heuristics', () => {
    const customOps: NormalizedOperation[] = [
      {
        id: 'listProjects',
        method: 'get',
        path: '/projects',
        summary: 'List projects',
        description: 'List all projects',
        tags: ['general'],
        parameters: [],
        inputSchema: { type: 'object' },
        riskTier: 'READ_ONLY',
      },
      {
        id: 'listTelemetry',
        method: 'get',
        path: '/telemetry',
        summary: 'IoT telemetry feed',
        description: 'IoT metrics',
        tags: ['iot'],
        parameters: [],
        inputSchema: { type: 'object' },
        riskTier: 'READ_ONLY',
      },
    ];

    // With hotToolKeywords: ['telemetry'], listTelemetry gets boosted ahead
    const registry = new ToolRegistry(customOps, {
      forceJIT: true,
      maxMountedTools: 1,
      hotToolKeywords: ['telemetry'],
    });

    const active = registry.getActiveOperations();
    expect(active.length).toBe(1);
    expect(active[0].id).toBe('listTelemetry');
  });

  it('should dynamically infer entity keywords from spec tags without manual configuration', () => {
    const scrapingOps: NormalizedOperation[] = [
      {
        id: 'scrapeUrl',
        method: 'get',
        path: '/scrape',
        summary: 'Scrape a single web page',
        description: 'Extract markdown from a URL',
        tags: ['scraping'],
        parameters: [],
        inputSchema: { type: 'object' },
        riskTier: 'READ_ONLY',
      },
      {
        id: 'crawlSite',
        method: 'get',
        path: '/crawl',
        summary: 'Start crawl job',
        description: 'Crawl entire site',
        tags: ['scraping'],
        parameters: [],
        inputSchema: { type: 'object' },
        riskTier: 'READ_ONLY',
      },
      {
        id: 'getHealth',
        method: 'get',
        path: '/health',
        summary: 'System health check',
        description: 'Returns server status',
        tags: ['maintenance'],
        parameters: [],
        inputSchema: { type: 'object' },
        riskTier: 'READ_ONLY',
      },
    ];

    // Tags 'scraping' appears twice, becoming the primary domain tag
    const registry = new ToolRegistry(scrapingOps, { forceJIT: true, maxMountedTools: 2 });
    const active = registry.getActiveOperations();
    const activeIds = active.map((o) => o.id);
    expect(activeIds).toContain('scrapeUrl');
    expect(activeIds).toContain('crawlSite');
  });
});
