import { describe, it, expect } from 'vitest';
import { parseHeaderFlags, parseApiKeyFlag, loadConfigFile } from '../src/config/loader.js';

describe('CLI Configuration and Flag Parser', () => {
  it('should parse custom header flags correctly', () => {
    const rawHeaders = [
      'Authorization: Bearer test_token',
      'X-Custom-Header: custom_val',
      'InvalidHeaderWithoutColon',
    ];

    const parsed = parseHeaderFlags(rawHeaders);
    expect(parsed['Authorization']).toBe('Bearer test_token');
    expect(parsed['X-Custom-Header']).toBe('custom_val');
    expect(parsed['InvalidHeaderWithoutColon']).toBeUndefined();
  });

  it('should parse API key flags with different locations', () => {
    const headerKey = parseApiKeyFlag('X-API-KEY=secret123');
    expect(headerKey).toEqual({ name: 'X-API-KEY', value: 'secret123', in: 'header' });

    const queryKey = parseApiKeyFlag('query:api_token=secret456');
    expect(queryKey).toEqual({ name: 'api_token', value: 'secret456', in: 'query' });

    const cookieKey = parseApiKeyFlag('cookie:session_id=sess789');
    expect(cookieKey).toEqual({ name: 'session_id', value: 'sess789', in: 'cookie' });
  });

  it('should load configuration files safely', () => {
    const config = loadConfigFile('non_existent_config.json');
    expect(config).toEqual({});
  });
});
