import { describe, it, expect } from 'vitest';
import { interpolateString, extractExports } from '../src/macro/template.js';
import { executeMacro } from '../src/macro/executor.js';
import { MacroDefinition } from '../src/parser/types.js';
import { ResilientHttpClient } from '../src/http/client.js';

describe('Macro Template & Workflow Executor', () => {
  it('should interpolate template parameters into action strings', () => {
    const template = 'GET /v1/customers?email={{email}}&limit={{limit}}';
    const context = { email: 'test@example.com', limit: 10 };

    const result = interpolateString(template, context);
    expect(result).toBe('GET /v1/customers?email=test@example.com&limit=10');
  });

  it('should extract exported variables from responses using JSONPath', () => {
    const response = {
      data: [
        { id: 'cus_999', name: 'John Doe' },
        { id: 'cus_888', name: 'Jane Doe' },
      ],
      total: 2,
    };

    const exportMap = {
      firstCustomerId: 'data[0].id',
      totalCount: 'total',
    };

    const extracted = extractExports(response, exportMap);
    expect(extracted.firstCustomerId).toBe('cus_999');
    expect(extracted.totalCount).toBe(2);
  });

  it('should protect macro execution when in dry-run mode (Finding 2)', async () => {
    const macro: MacroDefinition = {
      name: 'deleteCustomerData',
      description: 'Finds and deletes customer',
      parameters: { type: 'object' },
      steps: [
        { id: 'step1', action: 'GET /users?email={{email}}', export: { userId: 'id' } },
        { id: 'step2', action: 'DELETE /users/{{userId}}' },
      ],
    };

    const mockClient = new ResilientHttpClient({ baseUrl: 'https://api.example.com' });
    const result = await executeMacro(macro, { email: 'test@example.com' }, mockClient, true);

    expect(result.success).toBe(true);
    expect(result.isDryRun).toBe(true);
    expect(result.stepResults.length).toBe(2);
    expect(result.stepResults[1].data.simulation).toContain('[DRY-RUN] Would execute DELETE');
  });
});
