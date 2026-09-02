import { AuthConfig, Preset } from '@postmcp/types';

export function buildPresetAuthConfig(
  preset: Preset,
  env: Record<string, string | undefined> = process.env
): AuthConfig {
  const authConfig: AuthConfig = {
    headers: {},
    securitySchemes: {},
  };

  const envVarName = preset.authEnvVar;
  const secretValue = envVarName ? env[envVarName] : undefined;

  if (!secretValue) {
    return authConfig;
  }

  const authType = preset.authType || '';

  // 1. Basic Auth (e.g. Jira, Twilio, Zendesk, Cloudinary, Chargebee)
  if (authType.startsWith('Basic')) {
    authConfig.basicAuth = secretValue;
    authConfig.securitySchemes = {
      ...authConfig.securitySchemes,
      basicAuth: secretValue,
      BasicAuth: secretValue,
    };
    return authConfig;
  }

  // 2. Custom Header Formats (e.g. PagerDuty "Token token=...", Discord "Bot ...", OpsGenie "GenieKey ...")
  if (authType.includes('Token token=')) {
    authConfig.headers = {
      ...authConfig.headers,
      Authorization: `Token token=${secretValue}`,
    };
    authConfig.securitySchemes = {
      ...authConfig.securitySchemes,
      tokenAuth: secretValue,
    };
    return authConfig;
  }

  if (authType.includes('Bot ...') || authType.includes('Bot <token>') || preset.id === 'discord') {
    authConfig.headers = {
      ...authConfig.headers,
      Authorization: `Bot ${secretValue}`,
    };
    authConfig.securitySchemes = {
      ...authConfig.securitySchemes,
      botAuth: secretValue,
    };
    return authConfig;
  }

  if (authType.includes('GenieKey')) {
    authConfig.headers = {
      ...authConfig.headers,
      Authorization: `GenieKey ${secretValue}`,
    };
    authConfig.securitySchemes = {
      ...authConfig.securitySchemes,
      genieKeyAuth: secretValue,
    };
    return authConfig;
  }

  // 3. Specific Custom Header API Keys
  if (authType.startsWith('Header')) {
    let headerName = 'Authorization';

    if (authType.includes('PRIVATE-TOKEN')) {
      headerName = 'PRIVATE-TOKEN';
    } else if (authType.includes('X-Shopify-Access-Token')) {
      headerName = 'X-Shopify-Access-Token';
    } else if (authType.includes('x-api-key') || authType.includes('X-Api-Key') || authType.includes('X-API-KEY')) {
      headerName = authType.includes('X-Api-Key') ? 'X-Api-Key' : 'x-api-key';
    } else if (authType.includes('DD-API-KEY')) {
      headerName = 'DD-API-KEY';
    } else if (authType.includes('xi-api-key')) {
      headerName = 'xi-api-key';
    } else if (authType.includes('X-Postmark-Server-Token')) {
      headerName = 'X-Postmark-Server-Token';
    } else if (authType.includes('PLAID-SECRET')) {
      headerName = 'PLAID-SECRET';
    } else {
      const match = authType.match(/Header\s*\(([^)]+)\)/i);
      if (match && match[1]) {
        headerName = match[1].split('/')[0].trim();
      }
    }

    authConfig.headers = {
      ...authConfig.headers,
      [headerName]: secretValue,
    };

    authConfig.apiKey = {
      name: headerName,
      value: secretValue,
      in: 'header',
    };

    authConfig.securitySchemes = {
      ...authConfig.securitySchemes,
      privateToken: secretValue,
      shopifyAuth: secretValue,
      apiKeyAuth: secretValue,
      serverToken: secretValue,
      plaidAuth: secretValue,
      [headerName]: secretValue,
    };

    return authConfig;
  }

  // 4. Query Parameter Auth (e.g. Trello, YouTube)
  if (authType.startsWith('Query') || authType.includes('key=')) {
    const paramName = authType.includes('key=') ? 'key' : 'api_key';
    authConfig.apiKey = {
      name: paramName,
      value: secretValue,
      in: 'query',
    };
    authConfig.securitySchemes = {
      ...authConfig.securitySchemes,
      apiKeyAuth: secretValue,
      [paramName]: secretValue,
    };
    return authConfig;
  }

  // 5. Default: Bearer Token Auth (e.g. GitHub, Stripe, Linear, Notion, Supabase, OpenAI)
  authConfig.bearerToken = secretValue;
  authConfig.securitySchemes = {
    ...authConfig.securitySchemes,
    bearerAuth: secretValue,
    BearerAuth: secretValue,
    oauth2: secretValue,
  };

  return authConfig;
}
