import { describe, it, expect } from 'vitest';
import {
  ALL_PRESETS,
  PRESETS_BY_ID,
  getAllPresets,
  getPreset,
  getPresetsByCategory,
  searchPresets,
  getAllCategories,
} from '../src/index.js';

describe('Curated Presets Catalog (@postmcp/presets)', () => {
  it('should contain at least 50 curated API presets', () => {
    expect(ALL_PRESETS.length).toBeGreaterThanOrEqual(50);
  });

  it('should have unique non-empty IDs for every preset', () => {
    const seenIds = new Set<string>();
    for (const preset of ALL_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(seenIds.has(preset.id)).toBe(false);
      seenIds.add(preset.id);
    }
  });

  it('should have complete metadata for every preset', () => {
    for (const preset of ALL_PRESETS) {
      expect(preset.name).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.category).toBeTruthy();
      expect(preset.authType).toBeTruthy();
    }
  });

  it('should resolve presets by ID with or without @ prefix', () => {
    const github = getPreset('github');
    expect(github).toBeDefined();
    expect(github?.name).toBe('GitHub REST API');

    const stripe = getPreset('@stripe');
    expect(stripe).toBeDefined();
    expect(stripe?.category).toBe('Payments & Commerce');

    const unknown = getPreset('non_existent_api');
    expect(unknown).toBeUndefined();
  });

  it('should filter presets by category', () => {
    const devTools = getPresetsByCategory('Developer Tools');
    expect(devTools.length).toBeGreaterThanOrEqual(10);
    expect(devTools.every((p) => p.category === 'Developer Tools')).toBe(true);

    const cloud = getPresetsByCategory('Database & Cloud');
    expect(cloud.length).toBeGreaterThanOrEqual(5);

    const payments = getPresetsByCategory('Payments & Commerce');
    expect(payments.length).toBeGreaterThanOrEqual(5);
  });

  it('should search presets by query string across name, description, and tags', () => {
    const postgresResults = searchPresets('postgres');
    expect(postgresResults.some((p) => p.id === 'supabase')).toBe(true);
    expect(postgresResults.some((p) => p.id === 'neon')).toBe(true);

    const emailResults = searchPresets('email');
    expect(emailResults.some((p) => p.id === 'resend')).toBe(true);
    expect(emailResults.some((p) => p.id === 'sendgrid')).toBe(true);

    const paymentsResults = searchPresets('payments');
    expect(paymentsResults.some((p) => p.id === 'stripe')).toBe(true);
    expect(paymentsResults.some((p) => p.id === 'paypal')).toBe(true);
  });

  it('should return all standard categories', () => {
    const categories = getAllCategories();
    expect(categories).toContain('Developer Tools');
    expect(categories).toContain('Database & Cloud');
    expect(categories).toContain('Payments & Commerce');
    expect(categories).toContain('Communication & AI');
    expect(categories).toContain('Productivity & Support');
    expect(categories).toContain('Social & Media');
    expect(categories).toContain('Demo & Testing');
  });

  it('should have valid macro workflows defined in presets', () => {
    const github = getPreset('github');
    expect(github?.macros).toBeDefined();
    expect(github?.macros?.length).toBeGreaterThan(0);
    expect(github?.macros?.[0].steps.length).toBeGreaterThanOrEqual(2);

    const stripe = getPreset('stripe');
    expect(stripe?.macros).toBeDefined();
    expect(stripe?.macros?.length).toBeGreaterThan(0);
  });
});
