import { describe, it, expect } from 'vitest';
import {
  ALL_PRESETS,
  PRESETS_BY_ID,
  getAllPresets,
  getPreset,
  getPresetsByCategory,
  searchPresets,
  getAllCategories,
  buildPresetAuthConfig,
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

  it('should ensure 100% of presets (60/60) have a valid specUrl or bundledSpec', () => {
    for (const preset of ALL_PRESETS) {
      const hasSpec = Boolean(preset.specUrl || preset.bundledSpec);
      expect(hasSpec).toBe(true);

      if (preset.bundledSpec) {
        const doc = preset.bundledSpec as any;
        expect(doc.openapi).toBeTruthy();
        expect(doc.info?.title).toBeTruthy();
        expect(doc.paths).toBeDefined();
        expect(Object.keys(doc.paths).length).toBeGreaterThan(0);
      }
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

  it('should dispatch authentication configurations correctly for all preset auth types', () => {
    const mockEnv = {
      GITHUB_TOKEN: 'gh_secret_123',
      GITLAB_TOKEN: 'gl_secret_456',
      JIRA_API_TOKEN: 'user@example.com:jira_token_789',
      SHOPIFY_ACCESS_TOKEN: 'shpat_secret_abc',
      PAGERDUTY_TOKEN: 'pd_secret_xyz',
      DISCORD_BOT_TOKEN: 'discord_bot_secret',
      TRELLO_TOKEN: 'trello_key_secret',
      OPSGENIE_KEY: 'opsgenie_secret',
    };

    // 1. GitHub (Bearer Token)
    const github = getPreset('github')!;
    const githubAuth = buildPresetAuthConfig(github, mockEnv);
    expect(githubAuth.bearerToken).toBe('gh_secret_123');

    // 2. GitLab (Header PRIVATE-TOKEN)
    const gitlab = getPreset('gitlab')!;
    const gitlabAuth = buildPresetAuthConfig(gitlab, mockEnv);
    expect(gitlabAuth.headers?.['PRIVATE-TOKEN']).toBe('gl_secret_456');
    expect(gitlabAuth.apiKey?.name).toBe('PRIVATE-TOKEN');
    expect(gitlabAuth.apiKey?.value).toBe('gl_secret_456');

    // 3. Jira (Basic Auth)
    const jira = getPreset('jira')!;
    const jiraAuth = buildPresetAuthConfig(jira, mockEnv);
    expect(jiraAuth.basicAuth).toBe('user@example.com:jira_token_789');

    // 4. Shopify (Header X-Shopify-Access-Token)
    const shopify = getPreset('shopify')!;
    const shopifyAuth = buildPresetAuthConfig(shopify, mockEnv);
    expect(shopifyAuth.headers?.['X-Shopify-Access-Token']).toBe('shpat_secret_abc');
    expect(shopifyAuth.apiKey?.name).toBe('X-Shopify-Access-Token');

    // 5. PagerDuty (Header Token token=...)
    const pagerduty = getPreset('pagerduty')!;
    const pdAuth = buildPresetAuthConfig(pagerduty, mockEnv);
    expect(pdAuth.headers?.['Authorization']).toBe('Token token=pd_secret_xyz');

    // 6. Discord (Header Bot ...)
    const discord = getPreset('discord')!;
    const discordAuth = buildPresetAuthConfig(discord, mockEnv);
    expect(discordAuth.headers?.['Authorization']).toBe('Bot discord_bot_secret');

    // 7. Trello (Query param key=...)
    const trello = getPreset('trello')!;
    const trelloAuth = buildPresetAuthConfig(trello, mockEnv);
    expect(trelloAuth.apiKey?.name).toBe('key');
    expect(trelloAuth.apiKey?.in).toBe('query');
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
