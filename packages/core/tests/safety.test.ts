import { describe, it, expect } from 'vitest';
import { getToolAnnotations } from '../src/safety/classifier.js';
import { simulateExecution } from '../src/safety/dryrun.js';
import { NormalizedOperation } from '../src/parser/types.js';

describe('Safety Classifier & Dry-Run Simulator', () => {
  it('should assign readOnlyHint to GET operations', () => {
    const op: NormalizedOperation = {
      id: 'getUser',
      method: 'get',
      path: '/users/1',
      summary: 'Get User',
      description: 'Get user by id',
      tags: [],
      parameters: [],
      inputSchema: { type: 'object' },
      riskTier: 'READ_ONLY',
    };

    const annotations = getToolAnnotations(op);
    expect(annotations.readOnlyHint).toBe(true);
    expect(annotations.destructiveHint).toBe(false);
  });

  it('should assign destructiveHint to DELETE and CRITICAL operations', () => {
    const op: NormalizedOperation = {
      id: 'deleteAccount',
      method: 'delete',
      path: '/accounts/1',
      summary: 'Delete Account',
      description: 'Permanent deletion',
      tags: [],
      parameters: [],
      inputSchema: { type: 'object' },
      riskTier: 'CRITICAL',
    };

    const annotations = getToolAnnotations(op);
    expect(annotations.destructiveHint).toBe(true);
    expect(annotations.readOnlyHint).toBe(false);
  });

  it('should redact sensitive headers and body fields in dry-run mode (Finding 15)', () => {
    const op: NormalizedOperation = {
      id: 'dropDatabase',
      method: 'delete',
      path: '/db/main',
      summary: 'Drop DB',
      description: 'Drop',
      tags: [],
      parameters: [],
      inputSchema: { type: 'object' },
      riskTier: 'CRITICAL',
    };

    const headers = {
      authorization: 'Bearer secret_token',
      'X-API-KEY': 'api_key_123',
      'Custom-Header': 'public_val',
      Cookie: 'session=abc',
    };

    const body = {
      dbName: 'production',
      password: 'super_secret_password',
      adminToken: 'token_xyz',
    };

    const sim = simulateExecution(op, 'https://api.example.com/db/main', headers, { env: 'prod' }, body);
    expect(sim.isDryRun).toBe(true);
    expect(sim.targetUrl).toBe('https://api.example.com/db/main');
    expect(sim.queryParams).toEqual({ env: 'prod' });
    expect(sim.headers.authorization).toBe('[REDACTED]');
    expect(sim.headers['X-API-KEY']).toBe('[REDACTED]');
    expect(sim.headers.Cookie).toBe('[REDACTED]');
    expect(sim.headers['Custom-Header']).toBe('public_val');
    expect(sim.body.password).toBe('[REDACTED]');
    expect(sim.body.adminToken).toBe('[REDACTED]');
    expect(sim.body.dbName).toBe('production');
  });
});
