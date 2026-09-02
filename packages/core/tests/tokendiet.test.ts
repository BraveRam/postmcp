import { describe, it, expect } from 'vitest';
import { applyTokenDiet, pruneNullsAndNoise, arrayToMarkdownTable } from '../src/tokendiet/index.js';

describe('Token Diet Engine', () => {
  it('should prune nulls, empty strings, and HATEOAS link noise', () => {
    const raw = {
      id: 'usr_123',
      name: 'Alice',
      middleName: null,
      notes: '',
      emptyList: [],
      _links: { self: { href: '/users/usr_123' } },
      metadata: {
        tracking_id: 'trk_999',
        role: 'admin',
      },
    };

    const cleaned = pruneNullsAndNoise(raw);
    expect(cleaned).toEqual({
      id: 'usr_123',
      name: 'Alice',
      metadata: {
        role: 'admin',
      },
    });
  });

  it('should convert an array of objects into a compact Markdown table', () => {
    const records = [
      { id: '1', name: 'Fluffy', tag: 'cat', price: 50 },
      { id: '2', name: 'Barky', tag: 'dog', price: 100 },
    ];

    const table = arrayToMarkdownTable(records);
    expect(table).toContain('| id | name | tag | price |');
    expect(table).toContain('| 1 | Fluffy | cat | 50 |');
    expect(table).toContain('| 2 | Barky | dog | 100 |');
  });

  it('should achieve significant token reduction on list payloads', () => {
    const list = Array.from({ length: 30 }, (_, i) => ({
      id: `cus_${i}`,
      name: `Customer ${i}`,
      email: `customer${i}@example.com`,
      status: 'active',
      nullField: null,
      _links: { self: `/v1/customers/cus_${i}` },
    }));

    const result = applyTokenDiet(list, { enabled: true, convertToMarkdownTable: true });
    expect(result.savingsPercentage).toBeGreaterThan(50);
    expect(result.text).toContain('| id | name | email | status |');
    expect(result.text).not.toContain('_links');
    expect(result.text).not.toContain('nullField');
  });
});
