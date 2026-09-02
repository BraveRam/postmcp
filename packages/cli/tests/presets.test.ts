import { describe, it, expect } from 'vitest';
import { BUNDLED_PRESETS, resolvePresetSpec } from '../src/presets/index.js';

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

  it('should reject unknown preset aliases with helpful error message', async () => {
    await expect(resolvePresetSpec('@unknown_non_existent_api')).rejects.toThrow(
      "Unknown preset '@unknown_non_existent_api'"
    );
  });
});
