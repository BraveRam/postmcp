import { describe, it, expect, vi } from 'vitest';
import axios from 'axios';
import { isSameOriginOrAllowed, applyAuth } from '../src/http/auth.js';
import { serializeParameters, validateInputArguments } from '../src/http/serialize.js';
import { isIdempotentMethod, parseRetryAfter } from '../src/http/retry.js';
import { getExtensionFromContentType } from '../src/media/binary.js';
import { csvToMarkdownTable } from '../src/media/csv.js';
import { pollAsyncJob } from '../src/http/async202.js';
import { ResilientHttpClient } from '../src/http/client.js';

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
    const crossHeaders: Record<string, string> = { Authorization: 'Bearer old_leak' };
    applyAuth(crossHeaders, query, authConfig, attackerUrl, baseUrl);
    expect(crossHeaders.Authorization).toBeUndefined();
  });

  it('should support Basic Auth and API Keys in headers, query, and cookies', () => {
    const baseUrl = 'https://api.example.com';

    // 1. Basic Auth with username/password
    const headers1: Record<string, string> = {};
    applyAuth(headers1, {}, { basicAuth: { username: 'admin', password: 'secretpassword' } }, 'https://api.example.com/data', baseUrl);
    const expectedB64 = Buffer.from('admin:secretpassword').toString('base64');
    expect(headers1.Authorization).toBe(`Basic ${expectedB64}`);

    // 2. API Key in Cookie
    const headers2: Record<string, string> = {};
    applyAuth(headers2, {}, { apiKey: { name: 'sess_id', value: 'xyz123', in: 'cookie' } }, 'https://api.example.com/data', baseUrl);
    expect(headers2.Cookie).toBe('sess_id=xyz123');

    // 3. API Key in Query
    const query3: Record<string, any> = {};
    applyAuth({}, query3, { apiKey: { name: 'api_key', value: 'key_abc', in: 'query' } }, 'https://api.example.com/data', baseUrl);
    expect(query3.api_key).toBe('key_abc');
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

  it('should perform deep schema validation against types, enums, formats, and additionalProperties', () => {
    const inputSchema = {
      type: 'object',
      required: ['email', 'role', 'count'],
      properties: {
        email: { type: 'string', format: 'email' },
        role: { type: 'string', enum: ['admin', 'editor', 'viewer'] },
        count: { type: 'integer', minimum: 1, maximum: 100 },
        tags: { type: 'array', items: { type: 'string' }, minItems: 1 },
        profile: {
          type: 'object',
          required: ['bio'],
          properties: {
            bio: { type: 'string', minLength: 5 },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    };

    // Valid arguments
    const validArgs = {
      email: 'user@example.com',
      role: 'admin',
      count: 10,
      tags: ['tag1', 'tag2'],
      profile: { bio: 'Software engineer at PostMCP' },
    };
    const validRes = validateInputArguments(inputSchema, validArgs);
    expect(validRes.valid).toBe(true);
    expect(validRes.errors).toHaveLength(0);

    // Invalid email format & invalid enum
    const invalidFormat = validateInputArguments(inputSchema, {
      ...validArgs,
      email: 'not-an-email',
      role: 'superadmin',
    });
    expect(invalidFormat.valid).toBe(false);
    expect(invalidFormat.errors.some((e) => e.includes('Invalid email format'))).toBe(true);
    expect(invalidFormat.errors.some((e) => e.includes('not an allowed enum value'))).toBe(true);

    // Invalid integer (float or out of bounds)
    const invalidInt = validateInputArguments(inputSchema, {
      ...validArgs,
      count: 3.14,
    });
    expect(invalidInt.valid).toBe(false);
    expect(invalidInt.errors.some((e) => e.includes('expected integer'))).toBe(true);

    // Additional properties disallowed
    const invalidProps = validateInputArguments(inputSchema, {
      ...validArgs,
      extraField: 'not_allowed',
    });
    expect(invalidProps.valid).toBe(false);
    expect(invalidProps.errors.some((e) => e.includes('Unexpected property'))).toBe(true);
  });

  it('should poll 202 Accepted background jobs with JSON arraybuffer bodies and complete successfully', async () => {
    const initialResponse: any = {
      status: 202,
      statusText: 'Accepted',
      headers: {},
      data: Buffer.from(JSON.stringify({ status_url: '/api/v1/jobs/job_123', status: 'pending' })),
    };

    const spyGet = vi.spyOn(axios, 'get').mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      data: Buffer.from(JSON.stringify({ status: 'completed', result: { id: 123, status: 'done' } })),
    } as any);

    const result = await pollAsyncJob(initialResponse, 'https://api.example.com', { headers: {} }, 5000);
    expect(result.timedOut).toBe(false);
    expect(result.response.status).toBe(200);

    spyGet.mockRestore();
  });

  it('should set isPollingTimeout: true when 202 background job polling times out', async () => {
    const initialResponse: any = {
      status: 202,
      statusText: 'Accepted',
      headers: {},
      data: Buffer.from(JSON.stringify({ status_url: '/api/v1/jobs/slow_job', status: 'queued' })),
    };

    const spyGet = vi.spyOn(axios, 'get').mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      data: Buffer.from(JSON.stringify({ status: 'running' })),
    } as any);

    // Very short timeout (50ms) to trigger timeout condition immediately
    const result = await pollAsyncJob(initialResponse, 'https://api.example.com', { headers: {} }, 50);
    expect(result.timedOut).toBe(true);

    spyGet.mockRestore();
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

  it('should complete 202 polling immediately when status endpoint returns HTTP 200 payload without status field', async () => {
    const initialResponse: any = {
      status: 202,
      statusText: 'Accepted',
      headers: { location: '/api/v1/jobs/finished_job' },
      data: Buffer.from(JSON.stringify({ message: 'Job accepted' })),
    };

    const spyGet = vi.spyOn(axios, 'get').mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      data: Buffer.from(JSON.stringify({ id: 'res_999', download_url: 'https://example.com/file.zip' })),
    } as any);

    const result = await pollAsyncJob(initialResponse, 'https://api.example.com', { headers: {} }, 5000);
    expect(result.timedOut).toBe(false);
    expect(result.response.status).toBe(200);

    spyGet.mockRestore();
  });

  it('should enforce per-operation security schemes and respect public security: [] overrides', () => {
    const specSecuritySchemes: any = {
      ApiKeyHeader: { type: 'apiKey', in: 'header', name: 'X-API-KEY' },
      CookieAuth: { type: 'apiKey', in: 'cookie', name: 'session_id' },
      QueryAuth: { type: 'apiKey', in: 'query', name: 'api_token' },
      BearerAuth: { type: 'http', scheme: 'bearer' },
    };

    const authConfig = {
      securitySchemes: {
        ApiKeyHeader: 'header_secret_123',
        CookieAuth: 'cookie_secret_456',
        QueryAuth: 'query_secret_789',
        BearerAuth: 'bearer_token_xyz',
      },
    };

    const baseUrl = 'https://api.example.com';
    const targetUrl = 'https://api.example.com/data';

    // 1. Operation requiring ApiKeyHeader
    const headers1: Record<string, string> = {};
    const query1: Record<string, any> = {};
    applyAuth(headers1, query1, authConfig, targetUrl, baseUrl, [{ ApiKeyHeader: [] }], specSecuritySchemes);
    expect(headers1['X-API-KEY']).toBe('header_secret_123');
    expect(headers1['Authorization']).toBeUndefined();

    // 2. Operation requiring CookieAuth
    const headers2: Record<string, string> = {};
    const query2: Record<string, any> = {};
    applyAuth(headers2, query2, authConfig, targetUrl, baseUrl, [{ CookieAuth: [] }], specSecuritySchemes);
    expect(headers2['Cookie']).toBe('session_id=cookie_secret_456');

    // 3. Operation requiring QueryAuth
    const headers3: Record<string, string> = {};
    const query3: Record<string, any> = {};
    applyAuth(headers3, query3, authConfig, targetUrl, baseUrl, [{ QueryAuth: [] }], specSecuritySchemes);
    expect(query3['api_token']).toBe('query_secret_789');

    // 4. Operation with security: [] (public endpoint) -> NO auth injected
    const headers4: Record<string, string> = {};
    const query4: Record<string, any> = {};
    applyAuth(headers4, query4, authConfig, targetUrl, baseUrl, [], specSecuritySchemes);
    expect(headers4['X-API-KEY']).toBeUndefined();
    expect(headers4['Authorization']).toBeUndefined();
    expect(headers4['Cookie']).toBeUndefined();
    expect(query4['api_token']).toBeUndefined();
  });

  it('should reject credential injection across different protocols or ports (Strict Origin)', () => {
    const baseUrl = 'https://api.example.com';
    const httpMismatch = 'http://api.example.com/data';
    const portMismatch = 'https://api.example.com:8080/data';

    expect(isSameOriginOrAllowed(httpMismatch, baseUrl)).toBe(false);
    expect(isSameOriginOrAllowed(portMismatch, baseUrl)).toBe(false);

    const headers: Record<string, string> = {};
    applyAuth(headers, {}, { bearerToken: 'token123' }, httpMismatch, baseUrl);
    expect(headers.Authorization).toBeUndefined();
  });

  it('should throw error when required security scheme is unsatisfied', () => {
    const specSecuritySchemes: any = {
      BearerAuth: { type: 'http', scheme: 'bearer' },
    };

    const targetUrl = 'https://api.example.com/protected';
    const baseUrl = 'https://api.example.com';

    // Required security but empty/undefined config -> throws error
    expect(() => {
      applyAuth({}, {}, undefined, targetUrl, baseUrl, [{ BearerAuth: [] }], specSecuritySchemes);
    }).toThrow('Authentication Error: Operation requires security scheme [BearerAuth]');

    // Required security but wrong credential provided -> throws error
    expect(() => {
      applyAuth({}, {}, { securitySchemes: { OtherAuth: '123' } }, targetUrl, baseUrl, [{ BearerAuth: [] }], specSecuritySchemes);
    }).toThrow('Authentication Error: Operation requires security scheme [BearerAuth]');

    // Optional security (contains `{}`) -> does not throw error
    expect(() => {
      applyAuth({}, {}, undefined, targetUrl, baseUrl, [{ BearerAuth: [] }, {}], specSecuritySchemes);
    }).not.toThrow();
  });
});
