# @postmcp/studio

> **PostMCP Visual Web Studio** - Interactive OpenAPI to MCP developer workbench built with Next.js 16 and Turbopack.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Next.js 16](https://img.shields.io/badge/Next.js-16.3.4-black.svg)](https://nextjs.org/)
[![npm package](https://img.shields.io/badge/npm-@postmcp/studio-green.svg)](https://www.npmjs.com/package/@postmcp/studio)

---

## Overview

`@postmcp/studio` is the visual workbench for PostMCP. It gives developers an interactive graphical interface to inspect OpenAPI endpoints, visually curate Token Diet field masks, construct multi-step macros, test tools in a live sandbox, and export 1-click client configurations.

### Key Capabilities

* **API Explorer**: Browse and search operations with risk tier badges, method tags, and parameter schemas.
* **Token Diet Curator**: Visually select which response fields to include or exclude with live token savings counters.
* **Macro Builder**: Visually compose chained multi-step tools with parameter interpolation (`{{params.id}}`) and JSONPath extraction.
* **Live AI Sandbox**: Test tools using multi-model AI providers (OpenAI, Anthropic, Google) or offline simulation with sequential step cards and dry-run safeguard banners.
* **1-Click Exporter**: Generate ready-to-use configuration files for Cursor (`.cursor/mcp.json`), Claude Desktop, and Windsurf, supporting up to 10 environment variable credentials.
* **Direct Workspace Persistence**: Save curated configurations directly to your local project root (`postmcp.config.json`).

---

## Launching the Studio

The easiest way to launch the studio is via `@postmcp/cli`:

```bash
# Launch with zero install
npx @postmcp/cli studio

# Launch directly with a specific OpenAPI specification
npx @postmcp/cli studio https://api.stripe.com/openapi.json
```

---

## Running Locally for Development

```bash
# Clone the repository
git clone https://github.com/BraveRam/postmcp.git
cd postmcp

# Install dependencies and build
pnpm install
pnpm build

# Start the studio dev server
pnpm --filter @postmcp/studio dev
```

Open `http://localhost:3000` in your browser.

---

## License

MIT (c) [PostMCP Contributors](https://github.com/BraveRam/postmcp/blob/main/LICENSE)
