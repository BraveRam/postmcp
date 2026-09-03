# @postmcp/presets

> **Curated API Presets for PostMCP** - 60+ pre-tuned, context-optimized configurations for developer platforms, cloud providers, and SaaS APIs.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![MCP Compliant](https://img.shields.io/badge/MCP-100%25-green.svg)](https://modelcontextprotocol.io/)
[![npm package](https://img.shields.io/badge/npm-@postmcp/presets-yellow.svg)](https://www.npmjs.com/package/@postmcp/presets)

---

## Overview

`@postmcp/presets` contains a catalog of over 60 curated API presets configured specifically for Model Context Protocol (MCP) clients.

Each preset includes:
* Direct links to validated OpenAPI specifications.
* Pre-tuned **Token Diet field masks** to keep context windows small.
* Pre-configured **composite macros** for common multi-step tasks.
* Environment variable and credential mappings.

---

## Installation

```bash
npm install @postmcp/presets
# or
pnpm add @postmcp/presets
```

---

## Programmatic Usage

```typescript
import { ALL_PRESETS, getPresetById, getPresetsByCategory } from '@postmcp/presets';

// 1. Get a specific preset by ID
const stripePreset = getPresetById('stripe');
console.log(stripePreset.title); // "Stripe Payments API"
console.log(stripePreset.defaultFieldMask); // Pre-tuned fields

// 2. Filter presets by category
const devPresets = getPresetsByCategory('developer');
console.log(`Found ${devPresets.length} developer tool presets`);

// 3. List all available preset IDs
const ids = ALL_PRESETS.map((p) => p.id);
console.log(ids);
```

---

## Included Categories & Sample Presets

* **Developer Tools**: `@github`, `@gitlab`, `@linear`, `@sentry`, `@datadog`, `@postman`
* **Finance & Payments**: `@stripe`, `@plaid`, `@square`, `@coinbase`
* **Cloud & Infrastructure**: `@supabase`, `@cloudflare`, `@digitalocean`, `@render`, `@vercel`
* **AI & Machine Learning**: `@openai`, `@anthropic`, `@huggingface`, `@replicate`
* **Communication & Collaboration**: `@slack`, `@twilio`, `@sendgrid`, `@discord`, `@zoom`
* **E-Commerce & CRM**: `@shopify`, `@hubspot`, `@notion`, `@airtable`

---

## CLI Integration

Use any preset directly with `@postmcp/cli`:

```bash
# Instant zero-config execution
npx @postmcp/cli run @stripe --token-diet --jit

# Export configuration for Cursor
npx @postmcp/cli export @linear --client cursor --write

# Browse available presets
npx @postmcp/cli presets
```

---

## License

MIT (c) [PostMCP Contributors](https://github.com/BraveRam/postmcp/blob/main/LICENSE)
