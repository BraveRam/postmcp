import { describe, it, expect } from 'vitest';
import {
  applyTokenDiet,
  pruneNullsAndNoise,
  arrayToMarkdownTable,
  applyFieldMask,
  stripHtml,
} from '../src/tokendiet/index.js';

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

  it('should handle payload that prunes entirely to undefined without crashing (Finding 16)', () => {
    const raw = {
      onlyNull: null,
      emptyString: '',
      nestedNull: { sub: null },
    };

    const result = applyTokenDiet(raw, { enabled: true });
    expect(result.text).toBe('{}');
    expect(result.dietEstimatedTokens).toBeGreaterThan(0);
    expect(result.isTruncated).toBe(false);
  });

  it('should preserve nested structure and not fail open on invalid masks (Finding 17)', () => {
    const data = {
      user: {
        id: 7,
        profile: { email: 'test@example.com', secret: 'hidden' },
      },
      other: 'value',
    };

    // Valid nested mask
    const masked = applyFieldMask(data, ['user.profile.email']);
    expect(masked).toEqual({
      user: {
        profile: {
          email: 'test@example.com',
        },
      },
    });

    // Invalid mask should return empty object, not original payload (fail-safe)
    const invalidMasked = applyFieldMask(data, ['nonExistentField']);
    expect(invalidMasked).toEqual({});
  });

  it('should strip HTML tags and cap long prose fields (Finding 21)', () => {
    const htmlSnippet = '<p>Hello <b>World</b>! <script>alert(1)</script></p>';
    expect(stripHtml(htmlSnippet)).toBe('Hello World!');

    const longProse = 'A'.repeat(2000);
    const cleaned = pruneNullsAndNoise({ desc: longProse }, 100);
    expect(cleaned.desc.length).toBeLessThan(150);
    expect(cleaned.desc).toContain('... [truncated]');
  });

  it('should strictly enforce max token ceiling (Finding 18)', () => {
    const hugeList = Array.from({ length: 500 }, (_, i) => ({
      id: `item_${i}`,
      name: `Very long descriptive name for item ${i} with extra text and attributes`,
    }));

    const result = applyTokenDiet(hugeList, { maxTokens: 100 });
    expect(result.isTruncated).toBe(true);
    expect(result.dietEstimatedTokens).toBeLessThanOrEqual(100);
  });

  it('should strictly honor maxTokens: 1 ceiling without crashing', () => {
    const sampleData = {
      message: 'Hello World',
      items: [1, 2, 3, 4, 5],
    };

    const result = applyTokenDiet(sampleData, { maxTokens: 1 });
    expect(result.isTruncated).toBe(true);
    expect(result.dietEstimatedTokens).toBeLessThanOrEqual(1);
    expect(result.text.length).toBeLessThanOrEqual(3);
  });

  it('should support JSONPath root-array expressions and preserve array structure', () => {
    const rootArray = [
      { id: 'usr_1', name: 'Alice', secret: 'hide1' },
      { id: 'usr_2', name: 'Bob', secret: 'hide2' },
    ];

    // Array root with $[*].id
    const masked1 = applyFieldMask(rootArray, ['$[*].id']);
    expect(masked1).toEqual([{ id: 'usr_1' }, { id: 'usr_2' }]);

    // Array root with multiple fields
    const masked2 = applyFieldMask(rootArray, ['$[*].id', '$[*].name']);
    expect(masked2).toEqual([
      { id: 'usr_1', name: 'Alice' },
      { id: 'usr_2', name: 'Bob' },
    ]);

    // Simple field name on array root
    const masked3 = applyFieldMask(rootArray, ['name']);
    expect(masked3).toEqual([{ name: 'Alice' }, { name: 'Bob' }]);
  });
});
