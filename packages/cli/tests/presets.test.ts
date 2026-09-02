import { describe, it, expect } from 'vitest';
import { BUNDLED_PRESETS, resolvePresetSpec } from '../src/presets/index.js';
import { parseOpenAPI } from '@postmcp/core';

describe('Presets Catalog & Resolver', () => {
  it('should contain metadata for key developer APIs in bundled presets', () => {
    expect(BUNDLED_PRESETS['github']).toBeDefined();
    expect(BUNDLED_PRESETS['stripe']).toBeDefined();
    expect(BUNDLED_PRESETS['linear']).toBeDefined();
    expect(BUNDLED_PRESETS['slack']).toBeDefined();
    expect(BUNDLED_PRESETS['petstore']).toBeDefined();

    expect(BUNDLED_PRESETS['stripe'].category).toBe('Payments & Commerce');
    expect(BUNDLED_PRESETS['github'].defaultBaseUrl).toBe('https://api.github.com');
  });

  it('should resolve and parse all preset specifications successfully without errors', async () => {
    // Test key presets across categories
    const testPresetIds = ['@linear', '@jira', '@shopify', '@notion', '@supabase', '@resend', '@petstore'];

    for (const presetId of testPresetIds) {
      const spec = await resolvePresetSpec(presetId);
      expect(spec).toBeDefined();

      const parsed = await parseOpenAPI(spec as any);
      expect(parsed.title).toBeTruthy();
      expect(parsed.operations.length).toBeGreaterThan(0);
    }
  });

  it('should reject unknown preset aliases with helpful error message', async () => {
    await expect(resolvePresetSpec('@unknown_non_existent_api')).rejects.toThrow(
      "Unknown preset '@unknown_non_existent_api'"
    );
  });
});
