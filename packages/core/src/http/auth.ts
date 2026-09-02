export interface AuthConfig {
  headers?: Record<string, string>;
  bearerToken?: string;
  apiKey?: {
    name: string;
    value: string;
    in: 'header' | 'query';
  };
}

export function substituteEnvVars(value: string): string {
  return value.replace(/\$([A-Z0-9_]+)|\$\{([A-Z0-9_]+)\}/g, (_, v1, v2) => {
    const varName = v1 || v2;
    return process.env[varName] || '';
  });
}

export function applyAuth(
  headers: Record<string, string>,
  queryParams: Record<string, any>,
  config?: AuthConfig
): void {
  if (!config) return;

  // 1. Custom Headers with env substitution
  if (config.headers) {
    for (const [k, v] of Object.entries(config.headers)) {
      headers[k] = substituteEnvVars(v);
    }
  }

  // 2. Bearer Token
  if (config.bearerToken) {
    const token = substituteEnvVars(config.bearerToken);
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 3. API Key
  if (config.apiKey) {
    const val = substituteEnvVars(config.apiKey.value);
    if (config.apiKey.in === 'header') {
      headers[config.apiKey.name] = val;
    } else if (config.apiKey.in === 'query') {
      queryParams[config.apiKey.name] = val;
    }
  }
}
