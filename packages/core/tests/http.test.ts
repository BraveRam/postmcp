import { describe, it, expect } from 'vitest';
import { isSameOriginOrAllowed, applyAuth } from '../src/http/auth.js';
import { serializeParameters, validateInputArguments } from '../src/http/serialize.js';
import { isIdempotentMethod, parseRetryAfter } from '../src/http/retry.js';
import { getExtensionFromContentType } from '../src/media/binary.js';
import { csvToMarkdownTable } from '../src/media/csv.js';

describe('Resilient HTTP, Auth, and Parameter Serialization', () => {
  it('should protect credentials from cross-origin SSRF leakage (Finding 3)', () => {
    const baseUrl = 'https://api.stripe.com/v1';
    const attackerUrl = 'https://evil-attacker.com/webhook';
    const allowedUrl = 'https://api.stripe.com/v1/refunds';

    expect(isSameOriginOrAllowed(allowedUrl, baseUrl)).toBe(true);
    expect(isSameOriginOrAllowed(attackerUrl, baseUrl)).toBe(false);

    const headers: Record<string, string> = {};
    const query: Record<string, any> = {};
    const authConfig = { bearerToken: 'secret_token_123' };

    // Same origin receives auth
    applyAuth(headers, query, authConfig, allowedUrl, baseUrl);
    expect(headers.Authorization).toBe('Bearer secret_token_123');

    // Cross-origin does NOT receive auth
    const crossHeaders: Record<string, string> = {};
    applyAuth(crossHeaders, query, authConfig, attackerUrl, baseUrl);
    expect(crossHeaders.Authorization).toBeUndefined();
  });

  it('should serialize OpenAPI parameters with deepObject, pipeDelimited, and form styles (Finding 9)', () => {
    const rawPath = '/users/{id}';
    const params = [
      { name: 'id', in: 'path' as const, required: true, schema: { type: 'string' } },
      { name: 'filter', in: 'query' as const, required: false, schema: { type: 'object' }, style: 'deepObject' },
      { name: 'tags', in: 'query' as const, required: false, schema: { type: 'array' }, style: 'pipeDelimited' },
      { name: 'sessionId', in: 'cookie' as const, required: false, schema: { type: 'string' } },
    ];

    const args = {
      id: 'usr_456',
      filter: { status: 'active', role: 'admin' },
      tags: ['ai', 'mcp', 'typescript'],
      sessionId: 'sess_999',
    };

    const serialized = serializeParameters(rawPath, params, args);
    expect(serialized.path).toBe('/users/usr_456');
    expect(serialized.queryParams['filter[status]']).toBe('active');
    expect(serialized.queryParams['filter[role]']).toBe('admin');
    expect(serialized.queryParams['tags']).toBe('ai|mcp|typescript');
    expect(serialized.cookieParams['sessionId']).toBe('sess_999');
  });

  it('should validate required input parameters before dispatch (Finding 11)', () => {
    const inputSchema = {
      type: 'object',
      required: ['id', 'amount'],
      properties: {
        id: { type: 'string' },
        amount: { type: 'number' },
      },
    };

    const validCheck = validateInputArguments(inputSchema, { id: '123', amount: 50 });
    expect(validCheck.valid).toBe(true);

    const invalidCheck = validateInputArguments(inputSchema, { id: '123' });
    expect(invalidCheck.valid).toBe(false);
    expect(invalidCheck.errors[0]).toContain("Missing required parameter: 'amount'");
  });

  it('should identify idempotent methods and handle bounded retry-after (Finding 20)', () => {
    expect(isIdempotentMethod('GET')).toBe(true);
    expect(isIdempotentMethod('DELETE')).toBe(true);
    expect(isIdempotentMethod('POST')).toBe(false);
    expect(isIdempotentMethod('POST', { 'Idempotency-Key': 'key_123' })).toBe(true);

    expect(parseRetryAfter('5')).toBe(5000);
    // Bounded cap (default 10s = 10000ms)
    expect(parseRetryAfter('120')).toBe(10000);
  });

  it('should detect media extensions and parse CSV into Markdown tables (Finding 21)', () => {
    expect(getExtensionFromContentType('application/pdf')).toBe('pdf');
    expect(getExtensionFromContentType('image/png')).toBe('png');
    expect(getExtensionFromContentType('text/csv')).toBe('csv');

    const csv = 'id,name,role\n1,Alice,Admin\n2,Bob,User';
    const md = csvToMarkdownTable(csv);
    expect(md).toContain('| id | name | role |');
    expect(md).toContain('| 1 | Alice | Admin |');
  });
});
