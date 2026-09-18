import { describe, it, expect } from 'vitest';
import { getClientConfigPath, buildClientConfigSnippet } from '../src/commands/export.js';

describe('1-Click Client Configuration Exporter', () => {
  it('should return valid config file paths for Cursor, Claude Desktop, Windsurf, OpenCode, Claude Code, and Codex', () => {
    const cursorPath = getClientConfigPath('cursor');
    expect(cursorPath).toContain('.cursor');
    expect(cursorPath).toContain('mcp.json');

    const claudePath = getClientConfigPath('claude');
    expect(claudePath).toContain('claude_desktop_config.json');

    const windsurfPath = getClientConfigPath('windsurf');
    expect(windsurfPath).toContain('windsurf');

    const opencodePath = getClientConfigPath('opencode');
    expect(opencodePath).toContain('opencode.json');

    const claudeCodePath = getClientConfigPath('claude-code');
    expect(claudeCodePath).toContain('.mcp.json');

    const codexPath = getClientConfigPath('codex');
    expect(codexPath).toContain('.codex');
    expect(codexPath).toContain('config.toml');
  });

  it('should build copyable MCP server configuration snippets with environment variables', () => {
    const snippet = buildClientConfigSnippet('github-api', 'https://api.github.com/openapi.json', {
      bearer: 'ghp_secret_token_123',
      baseUrl: 'https://api.github.com',
      env: ['CUSTOM_VAR=value_1'],
    });

    expect(snippet.mcpServers).toBeDefined();
    expect(snippet.mcpServers!['github-api']).toBeDefined();

    const config = snippet.mcpServers!['github-api'];
    expect(config.command).toBe('npx');
    expect(config.args).toEqual(['-y', '@postmcp/cli', 'run', 'https://api.github.com/openapi.json']);
    expect(config.env!['API_KEY']).toBe('ghp_secret_token_123');
    expect(config.env!['BEARER_TOKEN']).toBe('ghp_secret_token_123');
    expect(config.env!['BASE_URL']).toBe('https://api.github.com');
    expect(config.env!['CUSTOM_VAR']).toBe('value_1');
  });
});
