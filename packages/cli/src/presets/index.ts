import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import axios from 'axios';

export interface PresetMeta {
  id: string;
  name: string;
  description: string;
  category: string;
  authType: string;
  defaultBaseUrl?: string;
  specUrl?: string;
  bundledSpec?: object;
}

export const BUNDLED_PRESETS: Record<string, PresetMeta> = {
  petstore: {
    id: 'petstore',
    name: 'Swagger Petstore',
    description: 'Sample Petstore OpenAPI 3.0 API for testing and demoing MCP capabilities',
    category: 'Demo & Testing',
    authType: 'apiKey / None',
    defaultBaseUrl: 'https://petstore.swagger.io/v2',
    specUrl: 'https://petstore.swagger.io/v2/swagger.json',
  },
  github: {
    id: 'github',
    name: 'GitHub REST API',
    description: 'GitHub Official REST API for managing repos, issues, pull requests, and workflows',
    category: 'Developer Tools',
    authType: 'Bearer (GITHUB_TOKEN)',
    defaultBaseUrl: 'https://api.github.com',
    specUrl: 'https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json',
  },
  stripe: {
    id: 'stripe',
    name: 'Stripe API',
    description: 'Stripe Payments, Subscriptions, Customers, Invoices, and Billing API',
    category: 'Payments & Billing',
    authType: 'Bearer (STRIPE_SECRET_KEY)',
    defaultBaseUrl: 'https://api.stripe.com/v1',
    specUrl: 'https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json',
  },
  linear: {
    id: 'linear',
    name: 'Linear API',
    description: 'Linear Issue Tracking, Projects, and Team Workflow REST endpoints',
    category: 'Productivity',
    authType: 'Bearer (LINEAR_API_KEY)',
    defaultBaseUrl: 'https://api.linear.app',
  },
  slack: {
    id: 'slack',
    name: 'Slack Web API',
    description: 'Slack messaging, channels, bot interactions, and user management',
    category: 'Communication',
    authType: 'Bearer (SLACK_BOT_TOKEN)',
    defaultBaseUrl: 'https://slack.com/api',
    specUrl: 'https://raw.githubusercontent.com/slackapi/slack-api-specs/master/web-api/slack_web_openapi_v2.json',
  },
  resend: {
    id: 'resend',
    name: 'Resend Email API',
    description: 'Developer-first email delivery and transactional email service',
    category: 'Communication',
    authType: 'Bearer (RESEND_API_KEY)',
    defaultBaseUrl: 'https://api.resend.com',
    specUrl: 'https://raw.githubusercontent.com/resend/resend-openapi/main/openapi.json',
  },
  notion: {
    id: 'notion',
    name: 'Notion API',
    description: 'Notion Workspace, Databases, Pages, and Blocks REST API',
    category: 'Productivity',
    authType: 'Bearer (NOTION_API_KEY)',
    defaultBaseUrl: 'https://api.notion.com/v1',
  },
  supabase: {
    id: 'supabase',
    name: 'Supabase Management API',
    description: 'Manage Supabase projects, databases, auth settings, and edge functions',
    category: 'Database & Cloud',
    authType: 'Bearer (SUPABASE_ACCESS_TOKEN)',
    defaultBaseUrl: 'https://api.supabase.com/v1',
    specUrl: 'https://api.supabase.com/v1/openapi.json',
  },
  sentry: {
    id: 'sentry',
    name: 'Sentry API',
    description: 'Error monitoring, performance tracking, issue management, and release telemetry',
    category: 'Monitoring & DevOps',
    authType: 'Bearer (SENTRY_AUTH_TOKEN)',
    defaultBaseUrl: 'https://sentry.io/api/0',
  },
  shopify: {
    id: 'shopify',
    name: 'Shopify Admin API',
    description: 'Shopify E-Commerce, Products, Orders, Inventory, and Storefront Management',
    category: 'E-Commerce',
    authType: 'Header (X-Shopify-Access-Token)',
    defaultBaseUrl: 'https://{shop}.myshopify.com/admin/api/2024-01',
  },
};

export function getPresetCacheDir(): string {
  const dir = path.join(os.homedir(), '.postmcp', 'presets');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export async function resolvePresetSpec(presetIdOrAlias: string): Promise<string> {
  const cleanId = presetIdOrAlias.replace(/^@/, '').toLowerCase().trim();
  const preset = BUNDLED_PRESETS[cleanId];

  if (!preset) {
    throw new Error(`Unknown preset '@${cleanId}'. Run 'postmcp presets' to see all available presets.`);
  }

  // Check local cache first
  const cacheFile = path.join(getPresetCacheDir(), `${cleanId}.json`);
  if (fs.existsSync(cacheFile)) {
    return cacheFile;
  }

  // If remote spec URL exists, fetch and cache it
  if (preset.specUrl) {
    try {
      const res = await axios.get(preset.specUrl, { responseType: 'text' });
      fs.writeFileSync(cacheFile, res.data, 'utf-8');
      return cacheFile;
    } catch {
      // Return remote URL directly as fallback for parser
      return preset.specUrl;
    }
  }

  throw new Error(`Preset '@${cleanId}' requires custom spec import or sync.`);
}

export async function syncAllPresets(): Promise<string[]> {
  const synced: string[] = [];
  const cacheDir = getPresetCacheDir();

  for (const [id, preset] of Object.entries(BUNDLED_PRESETS)) {
    if (preset.specUrl) {
      try {
        const res = await axios.get(preset.specUrl, { timeout: 10000, responseType: 'text' });
        const filePath = path.join(cacheDir, `${id}.json`);
        fs.writeFileSync(filePath, res.data, 'utf-8');
        synced.push(id);
      } catch {
        // Skip offline / unreachable preset during batch sync
      }
    }
  }

  return synced;
}
