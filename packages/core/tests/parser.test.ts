import { describe, it, expect, vi } from 'vitest';
import * as path from 'node:path';
import axios from 'axios';
import { parseOpenAPI, dereferenceSpec } from '../src/parser/index.js';

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

    const spyGet = vi.spyOn(axios, 'get').mockResolvedValueOnce({
      status: 200,
      data: JSON.stringify(remoteSchemaDoc),
    } as any);

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
    expect((userOp.responseSchema as any).properties.name.type).toBe('string');

    spyGet.mockRestore();
  });
});
