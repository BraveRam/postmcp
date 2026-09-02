import { describe, it, expect, vi } from 'vitest';
import * as path from 'node:path';
import { createCli } from '../src/bin.js';
import { inspectCommand, estimateSpecTokenSavings } from '../src/commands/inspect.js';
import { exportCommand } from '../src/commands/export.js';

describe('CLI Command Surface & Integration Contract', () => {
  const fixturePath = path.join(__dirname, '..', '..', 'core', 'tests', 'fixtures', 'petstore.json');

  it('should support presets list subcommand without error', async () => {
    const cli = createCli();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await expect(cli.parseAsync(['node', 'postmcp', 'presets', 'list'])).resolves.toBeDefined();
    await expect(cli.parseAsync(['node', 'postmcp', 'presets'])).resolves.toBeDefined();

    logSpy.mockRestore();
  });

  it('should support export with --target cursor and --target claude', async () => {
    const cli = createCli();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await expect(
      cli.parseAsync(['node', 'postmcp', 'export', fixturePath, '--target', 'cursor'])
    ).resolves.toBeDefined();

    await expect(
      cli.parseAsync(['node', 'postmcp', 'export', fixturePath, '--target', 'claude'])
    ).resolves.toBeDefined();

    logSpy.mockRestore();
  });

  it('should calculate estimated token savings in inspect command (Finding 3)', () => {
    const mockSpec = {
      title: 'Petstore API',
      operations: [
        {
          id: 'listPets',
          description: 'List all pets with pagination and filters',
          inputSchema: {
            type: 'object',
            properties: { limit: { type: 'integer' }, page: { type: 'integer' } },
          },
        },
        {
          id: 'createPet',
          description: 'Create a new pet in the inventory system',
          inputSchema: {
            type: 'object',
            properties: { name: { type: 'string' }, tag: { type: 'string' } },
          },
        },
      ],
    };

    const savings = estimateSpecTokenSavings(mockSpec);
    expect(savings.rawTokens).toBeGreaterThan(0);
    expect(savings.optimizedTokens).toBeGreaterThan(0);
    expect(savings.savingsPct).toBeGreaterThan(0);
    expect(savings.savingsPct).toBeLessThanOrEqual(100);
  });

  it('should run inspect command and output token metrics and risk tiers', async () => {
    const logOutputs: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((msg) => {
      if (msg) logOutputs.push(String(msg));
    });

    await inspectCommand(fixturePath, {});

    const fullOutput = logOutputs.join('\n');
    expect(fullOutput).toContain('Swagger Petstore');
    expect(fullOutput).toContain('Est. Token Savings');
    expect(fullOutput).toContain('Token Diet & Context Optimization Preview');
    expect(fullOutput).toContain('Safety & Risk Tier Breakdown');

    logSpy.mockRestore();
  });
});
