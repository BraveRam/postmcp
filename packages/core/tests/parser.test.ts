import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { parseOpenAPI } from '../src/parser/index.js';

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

  it('should parse inline YAML string properly', async () => {
    const yamlSpec = `
openapi: 3.0.0
info:
  title: Minimal YAML API
  version: 2.0.0
paths:
  /status:
    get:
      summary: Health check
      responses:
        '200':
          description: OK
`;
    const spec = await parseOpenAPI(yamlSpec);
    expect(spec.title).toBe('Minimal YAML API');
    expect(spec.operations.length).toBe(1);
    expect(spec.operations[0].id).toBe('getStatus');
  });
});
