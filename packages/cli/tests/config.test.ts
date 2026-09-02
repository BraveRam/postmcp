import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
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

  it('should load configuration files safely and parse fieldMasks, macros, enabledOperations', () => {
    const tempConfigPath = path.join(os.tmpdir(), `postmcp-test-${Date.now()}.json`);
    fs.writeFileSync(
      tempConfigPath,
      JSON.stringify({
        spec: '@stripe',
        fieldMasks: {
          '/v1/charges': ['id', 'amount', 'status'],
        },
        macros: [
          {
            name: 'refundAndNotify',
            description: 'Refund charge and send receipt',
            parameters: { type: 'object', properties: {} },
            steps: [{ id: 'step_1', action: 'POST /v1/refunds' }],
          },
        ],
        enabledOperations: {
          listCharges: true,
          deleteAccount: false,
        },
      })
    );

    const config = loadConfigFile(tempConfigPath);
    expect(config.spec).toBe('@stripe');
    expect(config.fieldMasks?.['/v1/charges']).toEqual(['id', 'amount', 'status']);
    expect(config.macros?.length).toBe(1);
    expect(config.enabledOperations?.['deleteAccount']).toBe(false);

    fs.unlinkSync(tempConfigPath);
  });
});
