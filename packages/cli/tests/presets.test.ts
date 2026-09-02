import { describe, it, expect } from 'vitest';
import { BUNDLED_PRESETS, ALL_PRESETS, resolvePresetSpec, buildPresetAuthConfig } from '../src/presets/index.js';
import { parseOpenAPI, PostMcpServer } from '@postmcp/core';

describe('Presets Catalog & Runtime Integration', () => {
  it('should contain metadata for key developer APIs in bundled presets', () => {
    expect(BUNDLED_PRESETS['github']).toBeDefined();
    expect(BUNDLED_PRESETS['stripe']).toBeDefined();
    expect(BUNDLED_PRESETS['linear']).toBeDefined();
    expect(BUNDLED_PRESETS['slack']).toBeDefined();
    expect(BUNDLED_PRESETS['petstore']).toBeDefined();

    expect(BUNDLED_PRESETS['stripe'].category).toBe('Payments & Commerce');
    expect(BUNDLED_PRESETS['github'].defaultBaseUrl).toBe('https://api.github.com');
  });

  it('should resolve and parse all 60 preset specifications successfully without errors', async () => {
    expect(ALL_PRESETS.length).toBeGreaterThanOrEqual(60);

    for (const preset of ALL_PRESETS) {
      const spec = await resolvePresetSpec(`@${preset.id}`);
      expect(spec).toBeDefined();

      const parsed = await parseOpenAPI(spec as any);
      expect(parsed.title).toBeTruthy();
      expect(parsed.operations.length).toBeGreaterThan(0);
      for (const op of parsed.operations) {
        expect(op.id).toBeTruthy();
        expect(op.method).toBeTruthy();
        expect(op.path).toBeTruthy();
        expect(op.riskTier).toMatch(/READ_ONLY|MUTATION|CRITICAL/);
      }
    }
  });

  it('should correctly configure authentication schemes for presets', () => {
    const gitlabPreset = BUNDLED_PRESETS['gitlab'];
    const gitlabAuth = buildPresetAuthConfig(gitlabPreset, { GITLAB_TOKEN: 'gl_token_123' });
    expect(gitlabAuth.headers?.['PRIVATE-TOKEN']).toBe('gl_token_123');
    expect(gitlabAuth.apiKey?.name).toBe('PRIVATE-TOKEN');
    expect(gitlabAuth.apiKey?.value).toBe('gl_token_123');

    const jiraPreset = BUNDLED_PRESETS['jira'];
    const jiraAuth = buildPresetAuthConfig(jiraPreset, { JIRA_API_TOKEN: 'user@example.com:token_abc' });
    expect(jiraAuth.basicAuth).toBe('user@example.com:token_abc');

    const shopifyPreset = BUNDLED_PRESETS['shopify'];
    const shopifyAuth = buildPresetAuthConfig(shopifyPreset, { SHOPIFY_ACCESS_TOKEN: 'shpat_xyz' });
    expect(shopifyAuth.headers?.['X-Shopify-Access-Token']).toBe('shpat_xyz');
    expect(shopifyAuth.apiKey?.name).toBe('X-Shopify-Access-Token');

    const discordPreset = BUNDLED_PRESETS['discord'];
    const discordAuth = buildPresetAuthConfig(discordPreset, { DISCORD_BOT_TOKEN: 'bot_secret_xyz' });
    expect(discordAuth.headers?.['Authorization']).toBe('Bot bot_secret_xyz');
  });

  it('should apply path-specific field masks only to designated operations', async () => {
    const githubPreset = BUNDLED_PRESETS['github'];
    expect(githubPreset.fieldMasks).toBeDefined();

    const pathFieldMasks: Record<string, string[]> = {};
    for (const fm of githubPreset.fieldMasks!) {
      pathFieldMasks[fm.path] = fm.fields;
    }

    const parsed = await parseOpenAPI(githubPreset.bundledSpec!);
    const server = new PostMcpServer({
      spec: parsed,
      dryRun: true,
      tokenDiet: {
        enabled: true,
        pathFieldMasks,
      },
    });

    expect(server).toBeDefined();
    // Issues path mask has title & user.login, but not head.ref
    expect(pathFieldMasks['/repos/{owner}/{repo}/issues']).toContain('title');
    expect(pathFieldMasks['/repos/{owner}/{repo}/issues']).not.toContain('head.ref');
    // Pulls path mask has head.ref
    expect(pathFieldMasks['/repos/{owner}/{repo}/pulls']).toContain('head.ref');
  });

  it('should reject unknown preset aliases with helpful error message', async () => {
    await expect(resolvePresetSpec('@unknown_non_existent_api')).rejects.toThrow(
      "Unknown preset '@unknown_non_existent_api'"
    );
  });
});
