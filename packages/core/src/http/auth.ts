import { SecurityScheme, NormalizedOperation } from '../parser/types.js';

export interface AuthConfig {
  headers?: Record<string, string>;
  bearerToken?: string;
  apiKey?: {
    name: string;
    value: string;
    in: 'header' | 'query' | 'cookie';
  };
  basicAuth?:
    | {
        username?: string;
        password?: string;
      }
    | string;
  securitySchemes?: Record<string, any>;
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

export function stripSensitiveAuth(
  headers: Record<string, any>,
  queryParams?: Record<string, any>
): void {
  const sensitiveHeaderRegex =
    /^(authorization|proxy-authorization|cookie|x-api-key|api-key|x-token|api_key|token|auth|x-auth|session|x-session)/i;
  for (const key of Object.keys(headers)) {
    if (sensitiveHeaderRegex.test(key)) {
      delete headers[key];
    }
  }

  if (queryParams) {
    const sensitiveQueryRegex =
      /^(api_key|apikey|token|access_token|auth|key|secret|password|session|session_id)/i;
    for (const key of Object.keys(queryParams)) {
      if (sensitiveQueryRegex.test(key)) {
        delete queryParams[key];
      }
    }
  }
}

function applyGeneralAuth(
  headers: Record<string, string>,
  queryParams: Record<string, any>,
  config: AuthConfig
): void {
  // Bearer Token
  if (config.bearerToken && !headers['Authorization']) {
    const token = substituteEnvVars(config.bearerToken);
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Basic Auth
  if (config.basicAuth && !headers['Authorization']) {
    if (typeof config.basicAuth === 'string') {
      const raw = substituteEnvVars(config.basicAuth);
      const token = raw.includes(':') ? Buffer.from(raw).toString('base64') : raw;
      headers['Authorization'] = `Basic ${token}`;
    } else {
      const u = substituteEnvVars(config.basicAuth.username || '');
      const p = substituteEnvVars(config.basicAuth.password || '');
      const b64 = Buffer.from(`${u}:${p}`).toString('base64');
      headers['Authorization'] = `Basic ${b64}`;
    }
  }

  // API Key
  if (config.apiKey) {
    const val = substituteEnvVars(config.apiKey.value);
    if (config.apiKey.in === 'header') {
      headers[config.apiKey.name] = val;
    } else if (config.apiKey.in === 'query') {
      queryParams[config.apiKey.name] = val;
    } else if (config.apiKey.in === 'cookie') {
      const cookieVal = `${encodeURIComponent(config.apiKey.name)}=${encodeURIComponent(val)}`;
      headers['Cookie'] = headers['Cookie'] ? `${headers['Cookie']}; ${cookieVal}` : cookieVal;
    }
  }
}

export function applyAuth(
  headers: Record<string, string>,
  queryParams: Record<string, any>,
  config: AuthConfig | undefined,
  targetUrl: string,
  baseUrl: string,
  securityRequirement?: Array<Record<string, string[]>>,
  specSecuritySchemes?: Record<string, SecurityScheme>
): void {
  if (!config) return;

  // SSRF & Credential Leakage Protection (Finding 3):
  // Do NOT inject sensitive credentials into cross-origin URLs unless explicitly permitted.
  const isTargetAllowed =
    config.allowCrossOriginAuth || isSameOriginOrAllowed(targetUrl, baseUrl, config.allowedExternalHosts);

  if (!isTargetAllowed) {
    stripSensitiveAuth(headers, queryParams);
    return;
  }

  // 1. Custom Headers with env substitution (always applied if configured)
  if (config.headers) {
    for (const [k, v] of Object.entries(config.headers)) {
      headers[k] = substituteEnvVars(v);
    }
  }

  // If the operation explicitly declares empty security ([]), it's public: no auth should be injected
  if (Array.isArray(securityRequirement) && securityRequirement.length === 0) {
    return;
  }

  // Helper to apply a single named scheme from spec and config
  const applySingleScheme = (schemeName: string): boolean => {
    const schemeDef = specSecuritySchemes?.[schemeName];
    const schemeVal = config.securitySchemes?.[schemeName];

    // Check if configured under config.securitySchemes
    if (schemeVal !== undefined) {
      if (schemeDef) {
        if (schemeDef.type === 'http') {
          if (schemeDef.scheme?.toLowerCase() === 'bearer') {
            const token = typeof schemeVal === 'object' ? schemeVal.token || schemeVal.value : schemeVal;
            headers['Authorization'] = `Bearer ${substituteEnvVars(String(token))}`;
            return true;
          } else if (schemeDef.scheme?.toLowerCase() === 'basic') {
            if (typeof schemeVal === 'object' && (schemeVal.username || schemeVal.password)) {
              const u = substituteEnvVars(schemeVal.username || '');
              const p = substituteEnvVars(schemeVal.password || '');
              const b64 = Buffer.from(`${u}:${p}`).toString('base64');
              headers['Authorization'] = `Basic ${b64}`;
            } else {
              const raw = substituteEnvVars(typeof schemeVal === 'object' ? schemeVal.value || '' : String(schemeVal));
              const token = raw.includes(':') ? Buffer.from(raw).toString('base64') : raw;
              headers['Authorization'] = `Basic ${token}`;
            }
            return true;
          }
        } else if (schemeDef.type === 'apiKey') {
          const paramName = schemeDef.name || schemeName;
          const val = substituteEnvVars(typeof schemeVal === 'object' ? schemeVal.value || '' : String(schemeVal));
          if (schemeDef.in === 'header') {
            headers[paramName] = val;
            return true;
          } else if (schemeDef.in === 'query') {
            queryParams[paramName] = val;
            return true;
          } else if (schemeDef.in === 'cookie') {
            const cookieVal = `${encodeURIComponent(paramName)}=${encodeURIComponent(val)}`;
            headers['Cookie'] = headers['Cookie'] ? `${headers['Cookie']}; ${cookieVal}` : cookieVal;
            return true;
          }
        } else if (schemeDef.type === 'oauth2' || schemeDef.type === 'openIdConnect') {
          const token = typeof schemeVal === 'object' ? schemeVal.token || schemeVal.value : schemeVal;
          headers['Authorization'] = `Bearer ${substituteEnvVars(String(token))}`;
          return true;
        }
      }

      // Fallback if not defined in spec or generic object
      if (typeof schemeVal === 'string') {
        const val = substituteEnvVars(schemeVal);
        headers[schemeName] = val;
        return true;
      } else if (typeof schemeVal === 'object' && schemeVal !== null) {
        if (schemeVal.header) {
          headers[schemeVal.header] = substituteEnvVars(schemeVal.value || '');
          return true;
        } else if (schemeVal.query) {
          queryParams[schemeVal.query] = substituteEnvVars(schemeVal.value || '');
          return true;
        } else if (schemeVal.cookie) {
          const cookieVal = `${encodeURIComponent(schemeVal.cookie)}=${encodeURIComponent(substituteEnvVars(schemeVal.value || ''))}`;
          headers['Cookie'] = headers['Cookie'] ? `${headers['Cookie']}; ${cookieVal}` : cookieVal;
          return true;
        }
      }
    }

    // If no config.securitySchemes entry, check if generic auth fields match schemeDef
    if (schemeDef) {
      if (schemeDef.type === 'http' && schemeDef.scheme?.toLowerCase() === 'bearer' && config.bearerToken) {
        headers['Authorization'] = `Bearer ${substituteEnvVars(config.bearerToken)}`;
        return true;
      }
      if (schemeDef.type === 'http' && schemeDef.scheme?.toLowerCase() === 'basic' && config.basicAuth) {
        if (typeof config.basicAuth === 'string') {
          const raw = substituteEnvVars(config.basicAuth);
          const token = raw.includes(':') ? Buffer.from(raw).toString('base64') : raw;
          headers['Authorization'] = `Basic ${token}`;
        } else {
          const u = substituteEnvVars(config.basicAuth.username || '');
          const p = substituteEnvVars(config.basicAuth.password || '');
          headers['Authorization'] = `Basic ${Buffer.from(`${u}:${p}`).toString('base64')}`;
        }
        return true;
      }
      if (schemeDef.type === 'apiKey' && config.apiKey) {
        const paramName = schemeDef.name || config.apiKey.name;
        const targetIn = schemeDef.in || config.apiKey.in || 'header';
        const val = substituteEnvVars(config.apiKey.value);
        if (targetIn === 'header') {
          headers[paramName] = val;
          return true;
        } else if (targetIn === 'query') {
          queryParams[paramName] = val;
          return true;
        } else if (targetIn === 'cookie') {
          const cookieVal = `${encodeURIComponent(paramName)}=${encodeURIComponent(val)}`;
          headers['Cookie'] = headers['Cookie'] ? `${headers['Cookie']}; ${cookieVal}` : cookieVal;
          return true;
        }
      }
      if ((schemeDef.type === 'oauth2' || schemeDef.type === 'openIdConnect') && config.bearerToken) {
        headers['Authorization'] = `Bearer ${substituteEnvVars(config.bearerToken)}`;
        return true;
      }
    }

    return false;
  };

  // 2. If per-operation security requirements are specified
  if (Array.isArray(securityRequirement) && securityRequirement.length > 0) {
    // Each element in securityRequirement array is an OR alternative
    let satisfied = false;
    for (const reqObj of securityRequirement) {
      const schemeNames = Object.keys(reqObj);
      if (schemeNames.length === 0) {
        // Empty security requirement ({}) denotes optional/public authentication alternative
        satisfied = true;
        break;
      }

      let allApplied = true;
      for (const schemeName of schemeNames) {
        const applied = applySingleScheme(schemeName);
        if (!applied) {
          allApplied = false;
        }
      }
      if (allApplied) {
        satisfied = true;
        break;
      }
    }

    if (!satisfied) {
      applyGeneralAuth(headers, queryParams, config);
    }
  } else {
    // No specific security requirement or global default: apply all configured auth schemes
    if (config.securitySchemes) {
      for (const schemeName of Object.keys(config.securitySchemes)) {
        applySingleScheme(schemeName);
      }
    }

    applyGeneralAuth(headers, queryParams, config);
  }
}
