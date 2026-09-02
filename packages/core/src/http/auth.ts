export interface AuthConfig {
  headers?: Record<string, string>;
  bearerToken?: string;
  apiKey?: {
    name: string;
    value: string;
    in: 'header' | 'query';
  };
  allowedExternalHosts?: string[];
  allowCrossOriginAuth?: boolean;
}

export function substituteEnvVars(value: string): string {
  return value.replace(/\$([A-Z0-9_]+)|\$\{([A-Z0-9_]+)\}/g, (_, v1, v2) => {
    const varName = v1 || v2;
    return process.env[varName] || '';
  });
}

export function isSameOriginOrAllowed(targetUrl: string, baseUrl: string, allowedHosts?: string[]): boolean {
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    return true; // Relative URL is always same-origin
  }

  try {
    const targetHost = new URL(targetUrl).hostname.toLowerCase();
    const baseHost = new URL(baseUrl).hostname.toLowerCase();

    if (targetHost === baseHost) return true;

    if (allowedHosts && allowedHosts.some((h) => h.toLowerCase() === targetHost)) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

export function applyAuth(
  headers: Record<string, string>,
  queryParams: Record<string, any>,
  config: AuthConfig | undefined,
  targetUrl: string,
  baseUrl: string
): void {
  if (!config) return;

  // SSRF & Credential Leakage Protection (Finding 3):
  // Do NOT inject sensitive credentials into cross-origin URLs unless explicitly permitted.
  const isTargetAllowed =
    config.allowCrossOriginAuth || isSameOriginOrAllowed(targetUrl, baseUrl, config.allowedExternalHosts);

  if (!isTargetAllowed) {
    return;
  }

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
