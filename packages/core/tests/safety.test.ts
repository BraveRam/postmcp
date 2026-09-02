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

  it('should produce a non-destructive execution simulation in dry-run mode', () => {
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

    const sim = simulateExecution(op, '/db/main', { Authorization: 'Bearer secret_key' });
    expect(sim.isDryRun).toBe(true);
    expect(sim.message).toContain('[DRY-RUN SIMULATION]');
    expect(sim.headers.Authorization).toBe('[REDACTED]');
  });
});
