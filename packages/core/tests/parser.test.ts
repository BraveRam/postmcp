import { describe, it, expect, vi } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import axios, { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import {
  parseOpenAPI,
  dereferenceSpec,
  readCachedSpec,
  writeCachedSpec,
  clearSpecCache,
  getSpecCachePaths,
} from '../src/parser/index.js';

function createMockResponse(overrides: Partial<AxiosResponse>): AxiosResponse {
  return {
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as InternalAxiosRequestConfig,
    data: {},
    ...overrides,
  };
}

describe('OpenAPI Parser & AST Normalizer', () => {
  it('should parse and normalize a complex OpenAPI 3 spec with circular references', async () => {
    const fixturePath = path.join(__dirname, 'fixtures', 'petstore.json');
    const spec = await parseOpenAPI(fixturePath);

    expect(spec.title).toBe('Swagger Petstore');
    expect(spec.version).toBe('1.0.0');
    expect(spec.servers[0].url).toBe('https://petstore.swagger.io/v2');
    expect(spec.operations.length).toBe(5);

    const listPets = spec.operations.find((op) => op.id === 'listPets');
    expect(listPets).toBeDefined();
    expect(listPets?.method).toBe('get');
    expect(listPets?.riskTier).toBe('READ_ONLY');

    const deletePet = spec.operations.find((op) => op.id === 'deletePet');
    expect(deletePet).toBeDefined();
    expect(deletePet?.method).toBe('delete');
    expect(deletePet?.riskTier).toBe('CRITICAL');

    const getCategoryTree = spec.operations.find((op) => op.id === 'getCategoryTree');
    expect(getCategoryTree).toBeDefined();
    // Circular reference should not crash and terminate safely
    expect(getCategoryTree?.responseSchema).toBeDefined();
  });

  it('should generate fallback operation IDs without trailing } brace (Finding 6)', async () => {
    const specJson = {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/users/{userId}': {
          get: {
            summary: 'Get user',
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    };
    const spec = await parseOpenAPI(specJson);
    expect(spec.operations[0].id).toBe('getUsersByUserId');
    expect(spec.operations[0].id).not.toContain('}');
  });

  it('should classify dangerous GET endpoints as CRITICAL instead of READ_ONLY (Finding 14)', async () => {
    const specJson = {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/billing/refund': {
          get: {
            summary: 'Refund transaction via GET',
            responses: { '200': { description: 'OK' } },
          },
        },
        '/admin/wipe': {
          get: {
            summary: 'Wipe all cache',
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    };
    const spec = await parseOpenAPI(specJson);
    const refundOp = spec.operations.find((o) => o.path === '/billing/refund');
    const wipeOp = spec.operations.find((o) => o.path === '/admin/wipe');

    expect(refundOp?.riskTier).toBe('CRITICAL');
    expect(wipeOp?.riskTier).toBe('CRITICAL');
  });

  it('should extract macros defined in root spec document (Finding 22)', async () => {
    const specJson = {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0' },
      paths: {},
      macros: [
        {
          name: 'refundWorkflow',
          description: 'Refund workflow',
          parameters: { type: 'object' },
          steps: [{ id: 'step1', action: 'POST /refund' }],
        },
      ],
    };
    const spec = await parseOpenAPI(specJson);
    expect(spec.macros).toBeDefined();
    expect(spec.macros?.length).toBe(1);
    expect(spec.macros?.[0].name).toBe('refundWorkflow');
  });

  it('should fetch and dereference remote HTTP $ref schemas', async () => {
    const remoteSchemaDoc = {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
        },
      },
    };

    const spyGet = vi.spyOn(axios, 'get').mockResolvedValueOnce(
      createMockResponse({
        status: 200,
        data: JSON.stringify(remoteSchemaDoc),
      })
    );

    const specJson = {
      openapi: '3.0.0',
      info: { title: 'Remote Ref Test', version: '1.0' },
      paths: {
        '/user': {
          get: {
            summary: 'Get user',
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      $ref: 'https://example.com/schemas/models.json#/User',
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const spec = await parseOpenAPI(specJson);
    const userOp = spec.operations[0];
    expect(userOp.responseSchema).toBeDefined();
    expect(userOp.responseSchema?.properties?.name?.type).toBe('string');

    spyGet.mockRestore();
  });

  it('should fetch and dereference remote YAML $ref with direct pointer #/User', async () => {
    const remoteYaml = `
User:
  type: object
  properties:
    id:
      type: string
    role:
      type: string
`;

    const spyGet = vi.spyOn(axios, 'get').mockResolvedValueOnce(
      createMockResponse({
        status: 200,
        data: remoteYaml,
      })
    );

    const specJson = {
      openapi: '3.0.0',
      info: { title: 'Remote YAML Test', version: '1.0' },
      paths: {
        '/profile': {
          get: {
            summary: 'Get profile',
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      $ref: 'https://example.com/schemas.yaml#/User',
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const spec = await parseOpenAPI(specJson);
    const profileOp = spec.operations[0];
    expect(profileOp.responseSchema).toBeDefined();
    expect(profileOp.responseSchema?.properties?.role?.type).toBe('string');

    spyGet.mockRestore();
  });

  it('should preserve vendor extensions (x-*) on operations and pathItems', async () => {
    const specJson = {
      openapi: '3.0.0',
      info: { title: 'Extensions Test', version: '1.0' },
      paths: {
        '/analytics': {
          'x-path-tag': 'analytics-root',
          get: {
            summary: 'Get Analytics',
            'x-hot-tool': true,
            'x-priority': 'high',
            'x-custom-meta': { env: 'prod' },
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    };

    const spec = await parseOpenAPI(specJson);
    const op = spec.operations[0];
    expect(op.extensions).toBeDefined();
    expect(op.extensions?.['x-path-tag']).toBe('analytics-root');
    expect(op.extensions?.['x-hot-tool']).toBe(true);
    expect(op.extensions?.['x-priority']).toBe('high');
    expect(op.extensions?.['x-custom-meta']).toEqual({ env: 'prod' });
  });

  it('should unwrap composite allOf request body schemas into top-level tool parameters', async () => {
    const specJson = {
      openapi: '3.0.0',
      info: { title: 'Firecrawl Like API', version: '1.0' },
      paths: {
        '/scrape': {
          post: {
            summary: 'Scrape a URL',
            operationId: 'scrapeAndExtractFromUrl',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      {
                        type: 'object',
                        properties: {
                          url: { type: 'string', description: 'The URL to scrape' },
                        },
                        required: ['url'],
                      },
                      {
                        type: 'object',
                        properties: {
                          formats: { type: 'array', items: { type: 'string' } },
                          onlyMainContent: { type: 'boolean' },
                        },
                      },
                    ],
                  },
                },
              },
            },
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    };

    const spec = await parseOpenAPI(specJson);
    const op = spec.operations[0];
    expect(op.id).toBe('scrapeAndExtractFromUrl');
    expect(op.inputSchema).toBeDefined();
    expect(op.inputSchema?.type).toBe('object');
    expect(op.inputSchema?.properties?.url).toBeDefined();
    expect(op.inputSchema?.properties?.url.type).toBe('string');
    expect(op.inputSchema?.properties?.formats).toBeDefined();
    expect(op.inputSchema?.properties?.onlyMainContent).toBeDefined();
    expect(op.inputSchema?.required).toEqual(['url']);
  });

  describe('Remote Spec Disk Caching & Fallback', () => {
    const testUrl = 'https://api.example.com/openapi.json';
    const mockSpecObject = {
      openapi: '3.0.0',
      info: { title: 'Cached Remote Spec', version: '2.0.0' },
      paths: {
        '/status': {
          get: {
            summary: 'Get Status',
            operationId: 'getStatus',
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    };
    const mockSpecRaw = JSON.stringify(mockSpecObject);

    it('should fetch remote spec, cache to disk, and reuse cache on subsequent call', async () => {
      const tempCacheDir = path.join(os.tmpdir(), `postmcp-cache-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      const getSpy = vi.spyOn(axios, 'get').mockResolvedValue(
        createMockResponse({
          status: 200,
          data: mockSpecRaw,
        })
      );

      try {
        // First call - downloads and caches
        const spec1 = await parseOpenAPI(testUrl, { cacheDir: tempCacheDir });
        expect(spec1.title).toBe('Cached Remote Spec');
        expect(getSpy).toHaveBeenCalledTimes(1);

        // Verify disk cache was written
        const cached = await readCachedSpec(testUrl, tempCacheDir);
        expect(cached).not.toBeNull();
        expect(cached?.content).toBe(mockSpecRaw);
        expect(cached?.metadata?.url).toBe(testUrl);

        // Second call - should load from disk cache, no second axios.get call
        const spec2 = await parseOpenAPI(testUrl, { cacheDir: tempCacheDir });
        expect(spec2.title).toBe('Cached Remote Spec');
        expect(getSpy).toHaveBeenCalledTimes(1);
      } finally {
        getSpy.mockRestore();
        await fs.rm(tempCacheDir, { recursive: true, force: true });
      }
    });

    it('should bypass cache and re-download when refresh option is enabled', async () => {
      const tempCacheDir = path.join(os.tmpdir(), `postmcp-cache-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      const getSpy = vi.spyOn(axios, 'get').mockResolvedValue(
        createMockResponse({
          status: 200,
          data: mockSpecRaw,
        })
      );

      try {
        await parseOpenAPI(testUrl, { cacheDir: tempCacheDir });
        expect(getSpy).toHaveBeenCalledTimes(1);

        // Call again with refresh: true
        await parseOpenAPI(testUrl, { cacheDir: tempCacheDir, refresh: true });
        expect(getSpy).toHaveBeenCalledTimes(2);
      } finally {
        getSpy.mockRestore();
        await fs.rm(tempCacheDir, { recursive: true, force: true });
      }
    });

    it('should not read or write cache when noCache option is enabled', async () => {
      const tempCacheDir = path.join(os.tmpdir(), `postmcp-cache-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      const getSpy = vi.spyOn(axios, 'get').mockResolvedValue(
        createMockResponse({
          status: 200,
          data: mockSpecRaw,
        })
      );

      try {
        await parseOpenAPI(testUrl, { cacheDir: tempCacheDir, noCache: true });
        expect(getSpy).toHaveBeenCalledTimes(1);

        const cached = await readCachedSpec(testUrl, tempCacheDir);
        expect(cached).toBeNull();

        await parseOpenAPI(testUrl, { cacheDir: tempCacheDir, noCache: true });
        expect(getSpy).toHaveBeenCalledTimes(2);
      } finally {
        getSpy.mockRestore();
        await fs.rm(tempCacheDir, { recursive: true, force: true });
      }
    });

    it('should fall back gracefully to cached spec when remote network fails', async () => {
      const tempCacheDir = path.join(os.tmpdir(), `postmcp-cache-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      await writeCachedSpec(testUrl, mockSpecRaw, tempCacheDir);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const getSpy = vi.spyOn(axios, 'get').mockRejectedValue(new Error('Connection timeout 30000ms'));

      try {
        // Call with refresh: true to trigger network attempt which will fail
        const spec = await parseOpenAPI(testUrl, { cacheDir: tempCacheDir, refresh: true });
        expect(spec.title).toBe('Cached Remote Spec');
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Connection timeout 30000ms')
        );
      } finally {
        getSpy.mockRestore();
        warnSpy.mockRestore();
        await fs.rm(tempCacheDir, { recursive: true, force: true });
      }
    });

    it('should support clearing specific and all cached specs with clearSpecCache', async () => {
      const tempCacheDir = path.join(os.tmpdir(), `postmcp-cache-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      const url2 = 'https://api.example.com/v2/openapi.json';

      try {
        await writeCachedSpec(testUrl, mockSpecRaw, tempCacheDir);
        await writeCachedSpec(url2, mockSpecRaw, tempCacheDir);

        expect(await readCachedSpec(testUrl, tempCacheDir)).not.toBeNull();
        expect(await readCachedSpec(url2, tempCacheDir)).not.toBeNull();

        // Clear specific url
        await clearSpecCache(testUrl, tempCacheDir);
        expect(await readCachedSpec(testUrl, tempCacheDir)).toBeNull();
        expect(await readCachedSpec(url2, tempCacheDir)).not.toBeNull();

        // Clear all specs
        await clearSpecCache(undefined, tempCacheDir);
        expect(await readCachedSpec(url2, tempCacheDir)).toBeNull();
      } finally {
        await fs.rm(tempCacheDir, { recursive: true, force: true });
      }
    });
  });
});
