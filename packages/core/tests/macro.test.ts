import { describe, it, expect } from 'vitest';
import { interpolateString, extractExports } from '../src/macro/template.js';

describe('Macro Template & Variable Extraction', () => {
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
});
