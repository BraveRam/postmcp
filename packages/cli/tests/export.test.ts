import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { describe, it, expect } from 'vitest';
import { getClientConfigPath, buildClientConfigSnippet, buildCodexTomlSnippet, writeClientConfig } from '../src/commands/export.js';

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

  it('should build Codex TOML snippet with --no-jit flag and environment variables', () => {
    const snippet = buildCodexTomlSnippet('stripe-api', '@stripe', {
      bearer: 'sk_test_123',
      baseUrl: 'https://api.stripe.com',
    });

    expect(snippet).toContain('[mcp_servers.stripe-api]');
    expect(snippet).toContain('command = "npx"');
    expect(snippet).toContain('args = ["-y", "@postmcp/cli", "run", "@stripe", "--no-jit"]');
    expect(snippet).toContain('BEARER_TOKEN = "sk_test_123"');
    expect(snippet).toContain('BASE_URL = "https://api.stripe.com"');
  });

  describe('writeClientConfig Fail-Closed Safety & --force', () => {
    const testDir = path.join(os.tmpdir(), `postmcp-export-test-${Date.now()}`);

    it('should cleanly write a new config file when it does not exist', () => {
      const configPath = path.join(testDir, 'new-client', 'mcp.json');
      const res = writeClientConfig('cursor', 'my-api', '@github', { write: true }, configPath);

      expect(res.success).toBe(true);
      expect(fs.existsSync(configPath)).toBe(true);
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(parsed.mcpServers['my-api']).toBeDefined();
    });

    it('should cleanly merge into an existing valid config file preserving other servers', () => {
      const configPath = path.join(testDir, 'merge-client', 'mcp.json');
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          mcpServers: {
            'existing-db': {
              command: 'docker',
              args: ['run', 'postgres'],
            },
          },
        }),
        'utf-8'
      );

      const res = writeClientConfig('cursor', 'new-server', '@stripe', { write: true }, configPath);
      expect(res.success).toBe(true);

      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(parsed.mcpServers['existing-db']).toBeDefined();
      expect(parsed.mcpServers['new-server']).toBeDefined();
    });

    it('should fail closed and throw when existing config file has invalid JSON without --force', () => {
      const configPath = path.join(testDir, 'corrupt-client', 'mcp.json');
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      const malformedContent = '{\n  "mcpServers": {\n    "db": {},\n  }\n}'; // trailing comma
      fs.writeFileSync(configPath, malformedContent, 'utf-8');

      expect(() => {
        writeClientConfig('cursor', 'new-server', '@stripe', { write: true }, configPath);
      }).toThrow(/contains invalid JSON.*Aborting to prevent losing existing servers/);

      // Verify the malformed file is untouched
      expect(fs.readFileSync(configPath, 'utf-8')).toBe(malformedContent);
      expect(fs.existsSync(`${configPath}.bak`)).toBe(false);
    });

    it('should backup to .bak and overwrite when existing config is invalid and --force is passed', () => {
      const configPath = path.join(testDir, 'force-client', 'mcp.json');
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      const malformedContent = '{ invalid json content here }';
      fs.writeFileSync(configPath, malformedContent, 'utf-8');

      const res = writeClientConfig('cursor', 'new-server', '@stripe', { write: true, force: true }, configPath);
      expect(res.success).toBe(true);
      expect(res.backupPath).toBe(`${configPath}.bak`);

      // Verify .bak file contains original malformed content
      expect(fs.existsSync(`${configPath}.bak`)).toBe(true);
      expect(fs.readFileSync(`${configPath}.bak`, 'utf-8')).toBe(malformedContent);

      // Verify main config was overwritten with valid new config
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(parsed.mcpServers['new-server']).toBeDefined();
    });

    it('should fail closed for OpenCode when opencode.json contains invalid JSON without --force', () => {
      const configPath = path.join(testDir, 'corrupt-opencode', 'opencode.json');
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      const malformedContent = '{"mcp": { corrupted: true }}';
      fs.writeFileSync(configPath, malformedContent, 'utf-8');

      expect(() => {
        writeClientConfig('opencode', 'new-server', '@github', { write: true }, configPath);
      }).toThrow(/contains invalid JSON/);

      expect(fs.readFileSync(configPath, 'utf-8')).toBe(malformedContent);
    });
  });
});
