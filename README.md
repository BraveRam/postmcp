# PostMCP

> **The "Postman for MCP"** - Turn any OpenAPI or Swagger specification into a context-optimized, safe, type-safe Model Context Protocol (MCP) server in seconds.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![MCP Compliant](https://img.shields.io/badge/MCP-100%25-green.svg)](https://modelcontextprotocol.io/)
[![npm package](https://img.shields.io/badge/npm-postmcp-red.svg)](https://www.npmjs.com/package/postmcp)

---

## What is PostMCP?

PostMCP turns any REST API into native tools for AI coding assistants and agents (Cursor, Claude Desktop, Antigravity, Windsurf, LangChain).

Instead of writing hundreds of lines of custom MCP server boilerplate, hand-crafting JSON schemas, or dealing with context window bloat, PostMCP takes an OpenAPI/Swagger URL or file and automatically produces an optimized, ready-to-run MCP server.

### What It Does

* **Instant Zero-Code Connectivity**: Run any public or private API directly in your AI assistant over stdio or Streamable HTTP.
* **Context Optimization (Token Diet)**: Strips metadata, nulls, and boilerplate from API responses, automatically converting object arrays into compact Markdown tables to cut token usage by 70% to 95%.
* **Scales to Massive APIs (JIT Dynamic Routing)**: Replaces 600+ static tool definitions with an on-demand `tool_search` router, keeping active prompt context under 1,500 tokens.
* **Safety Circuit Breaker (Dry-Run)**: Classifies operations into read-only vs. destructive tiers and intercepts mutations before they touch production databases.
* **Atomic Multi-Step Macros**: Chains multi-step REST sequences (e.g., lookup -> create -> notify) into a single atomic tool executed in server memory.
* **Visual Web Studio**: An interactive dark-mode workbench (Next.js 16 + Turbopack) to test endpoints, configure field masks, and preview token savings in a live AI sandbox.
* **1-Click Export & Code Generation**: Generates configurations for Cursor, Claude Desktop, and Windsurf, or scaffolds complete standalone TypeScript (`@modelcontextprotocol/sdk`) or Python FastMCP repositories.

---

## The Problems PostMCP Solves

Connecting AI coding assistants to raw REST APIs with naive 1-to-1 converters creates four major roadblocks:

1. **Context Window Saturation**: Converting a 200+ endpoint REST spec (e.g., Stripe, GitHub, Jira) injects 30,000+ tokens of static tool schemas on every turn, degrading reasoning and causing tool hallucinations.
2. **Token Drowning**: Raw REST responses return 50KB+ of redundant JSON metadata (HATEOAS links, audit timestamps, internal IDs, null values), consuming context without providing signal.
3. **The CRUD Mismatch**: An AI agent often must make 3 to 5 slow, sequential round trips to satisfy a single user prompt (e.g., lookup user -> fetch orders -> cancel order).
4. **Blind Mutation Risk**: Destructive endpoints (`DELETE /database`, `POST /billing/charge`) are exposed alongside read endpoints with no distinction or dry-run protection.

PostMCP acts as the intelligent compilation and runtime layer that eliminates these issues before requests reach your LLM.

---

## Quickstart

Run any OpenAPI spec or pre-configured preset on the fly:

```bash
# Run any public OpenAPI spec with Token Diet and JIT tool search
npx postmcp run https://api.stripe.com/openapi.json \
  --header "Authorization: Bearer $STRIPE_SECRET_KEY" \
  --token-diet \
  --jit
```

### Launch the Visual Web Studio

```bash
npx postmcp studio
```

Open `http://localhost:3000` to visually inspect endpoints, curate field masks, chain macros, test prompts in the live sandbox, and export client configurations.

### 1-Click Cursor Setup (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "linear": {
      "command": "npx",
      "args": ["-y", "postmcp", "run", "https://api.linear.app/openapi.json", "--token-diet", "--jit"],
      "env": {
        "LINEAR_API_KEY": "${env:LINEAR_API_KEY}"
      }
    }
  }
}
```

---

## High-Level Architecture Topology

```text
                                  +----------------------------------------------------------------------+
                                  |                       PostMCP SUITE ARCHITECTURE                     |
                                  +----------------------------------------------------------------------+
                                  |                                                                      |
+---------------------------+     |  +-------------------------------+  +-----------------------------+  |     +---------------------------+
|     OpenAPI Specs         |     |  |       Visual Web Studio       |  |        CLI Interface        |  |     |       Target Clients      |
|  - OpenAPI 3.0 / 3.1      |---->|  |     (Next.js + Turbopack)     |  |     `npx postmcp <cmd>`     |  |---->|  - Cursor (.cursor/mcp)   |
|  - Swagger 2.0            |     |  |  - Visual Spec Curator        |  |     (run, studio, inspect,  |  |     |  - Claude Desktop Config  |
|  - Local file / Live URL  |     |  |  - Live LLM Test Sandbox      |  |      generate, presets,     |  |     |  - Antigravity / Windsurf |
|  - Presets (60+ APIs)     |     |  |    (Vercel AI Gateway)        |  |      export)                |  |     |  - Custom Python/TS Agents|
+---------------------------+     |  |  - Real-Time Token Visualizer |  |  (stdio & Streamable HTTP)  |  |     +---------------------------+
                                  |  +---------------+---------------+  +--------------+--------------+  |
                                  |                  |                                 |                 |
                                  |                  +----------------+----------------+                 |
                                  |                                   |                                  |
                                  |                                   v                                  |
                                  |                 +----------------------------------+                 |
                                  |                 |       packages/core Engine       |                 |
                                  |                 +----------------------------------+                 |
                                  |                 | 1. AST Parser & Ref Resolver     |                 |
                                  |                 | 2. Adaptive Hybrid JIT Router    |                 |
                                  |                 | 3. Smart Token Diet Engine       |                 |
                                  |                 | 4. 3-Tier Safety & Dry-Run       |                 |
                                  |                 | 5. Macro Workflow Chainer        |                 |
                                  |                 | 6. Media Adapter & Async 202     |                 |
                                  |                 | 7. Resilient HTTP & Rate Limiter |                 |
                                  |                 +-----------------+----------------+                 |
                                  |                                   |                                  |
                                  |         +-------------------------+------------------------+         |
                                  |         |                                                  |         |
                                  |         v                                                  v         |
                                  |  +-----------------------------+            +----------------------+ |
                                  |  |   Zero-Code Dynamic Proxy   |            | Standalone Code Gen  | |
                                  |  |  (In-Memory Dispatcher)     |            | (Python FastMCP, TS) | |
                                  |  +-----------------------------+            +----------------------+ |
                                  +----------------------------------------------------------------------+
```

---

## Core Capabilities & Deep Dive

### 1. JIT Dynamic Tool Router (`tool_search`)
For APIs with hundreds or thousands of endpoints (e.g., Stripe with 620+ endpoints, GitHub with 1,000+), mounting every tool statically exceeds context windows.

* PostMCP mounts a single meta-tool: `tool_search`.
* When the AI agent needs an operation, it searches by query (e.g., `tool_search({ query: "refund charge" })`).
* PostMCP dynamically mounts the matched operations in memory and notifies the client via the MCP `notifications/tools/list_changed` protocol.
* Context footprint remains **under 1,500 active tokens** regardless of API size.

### 2. Token Diet Engine
Raw API payloads contain excessive low-value data. The Token Diet engine compresses responses by **70% to 95%**:

* **Boilerplate Pruning**: Automatically strips null fields, empty arrays, link objects (`_links`, `href`), tracking metadata, and ETags.
* **Field Masking**: Interactive whitelist/blacklist selection per endpoint, configurable via Studio or `postmcp.config.json`.
* **Smart Markdown Tables**: Detects collection endpoints and serializes homogeneous JSON arrays into compact GitHub-flavored Markdown tables.
* **Single vs. Collection Differentiation**: Distinguishes single-entity records from arrays to prevent bloated sample arrays.

### 3. Safety Guardrails & Dry-Run Simulation
PostMCP analyzes HTTP methods, parameter semantics, and route naming to classify operations into three risk tiers:

* `READ_ONLY`: GET, HEAD, OPTIONS queries. Safe for autonomous model exploration. Annotated with `readOnlyHint: true`.
* `MUTATION`: POST, PUT, PATCH requests that modify state.
* `CRITICAL`: High-risk actions (e.g., delete, cancel, refund, purge, terminate). Annotated with `destructiveHint: true`.
* **Dry-Run Mode**: When `--dry-run` is active, mutations are intercepted before leaving the machine. Realistic simulated success data is returned with `[DRY RUN SAFEGUARD ACTIVE]`, allowing agents to complete full workflows without modifying live upstream data.

### 4. Composite Macro Pipelines
Macros collapse multi-step CRUD sequences into a single atomic MCP tool executed entirely in server memory:

* Chained steps with parameter interpolation (`{{params.query}}`, `{{steps[0].id}}`).
* JSONPath extraction for passing dynamic responses downstream (`$.data[0].id`).
* Built-in private network and SSRF safeguards preventing loopback attacks.
* Single round-trip execution for the AI client instead of multiple slow turns.

### 5. Visual Web Studio & AI Sandbox
A local Next.js 16 + Turbopack development workbench:

* **API Explorer**: Horizontally resizable navigation with localStorage state persistence.
* **Token Diet Curator**: Live token reduction counters and side-by-side JSON vs. Markdown table preview.
* **Macro Builder**: Interactive UI for designing chained multi-step tools.
* **Live Sandbox**: Test tools using Vercel AI Gateway models or an intelligent offline simulation runner. Supports AI SDK multi-step loops (`stopWhen: stepCountIs(5)`), sequential tool step cards, and dry-run banners.

### 6. Client Exporter & Code Generator
Deploy configurations or generate standalone production services:

* **1-Click Exporter**: Generates ready-to-use snippets for Cursor, Claude Desktop, Windsurf, or `postmcp.config.json`. Supports up to 10 environment variable credentials.
* **Direct Workspace Persistence**: Save configuration directly to your project root with one click.
* **Standalone Code Generation**: Generate a self-contained TypeScript (`@modelcontextprotocol/sdk`) or Python FastMCP project complete with tests, dependencies, and Dockerfile:
  ```bash
  # Generate standalone TypeScript server
  postmcp generate ./stripe.postmcp.json --lang ts -o ./my-stripe-mcp

  # Generate standalone Python FastMCP server
  postmcp generate ./stripe.postmcp.json --lang py -o ./my-stripe-mcp-py
  ```

### 7. 60+ Curated API Presets
Zero-configuration presets for leading developer APIs:

```bash
postmcp run @stripe       # Stripe Payments API
postmcp run @github       # GitHub REST API
postmcp run @linear       # Linear Issue Tracking
postmcp run @slack        # Slack Web API
postmcp run @supabase     # Supabase Management API
postmcp run @twilio       # Twilio Communications API
postmcp run @openai       # OpenAI Platform API
```

Each preset comes with pre-tuned Token Diet field masks, macros, and authentication mappings.

### 8. Multimodal Adapters & Async 202 Polling
* **Image Formatting**: Automatically detects image responses (`image/png`, `image/jpeg`, `image/webp`), base64 encodes them, and returns native MCP image content blocks for vision models.
* **CSV Parsing**: Converts `text/csv` payloads into structured Markdown tables.
* **HTTP 202 Async Polling**: Autonomously follows `Location` headers and polls background tasks until completion, streaming the final payload back to the LLM in a single turn.

---

## CLI Command Reference

### `postmcp run <spec>`
Run an MCP server from an OpenAPI spec, URL, or preset.

| Option | Description |
| :--- | :--- |
| `-t, --transport <type>` | Transport type: `stdio` (default) or `http` |
| `-p, --port <number>` | Port for HTTP transport (default: 3000) |
| `-H, --header <k:v...>` | Custom headers to forward to the target API |
| `--bearer <token>` | Bearer token for API authentication |
| `--api-key <key>` | API key for authentication |
| `--token-diet` | Enable Token Diet response optimization |
| `--jit` | Enable Just-In-Time dynamic tool routing |
| `--dry-run` | Intercept and simulate destructive mutations |
| `--config <path>` | Path to `postmcp.config.json` |

### `postmcp studio [spec]`
Launch the visual web studio.

| Option | Description |
| :--- | :--- |
| `-p, --port <number>` | Port for the studio server (default: 3000) |
| `--no-open` | Start the server without opening the default browser |

### `postmcp inspect <spec>`
Analyze an OpenAPI spec and view risk tiers, method counts, and token estimates.

| Option | Description |
| :--- | :--- |
| `--json` | Output machine-readable normalized AST JSON |

### `postmcp generate <spec>`
Generate a standalone TypeScript or Python MCP server codebase.

| Option | Description |
| :--- | :--- |
| `-t, --target <lang>` | Target language: `ts` or `py` (default: `ts`) |
| `-l, --lang <lang>` | Alias for `--target` |
| `-o, --out <dir>` | Output directory for the generated project |

### `postmcp export <spec>`
Export configuration snippets for AI clients.

| Option | Description |
| :--- | :--- |
| `-t, --target <client>`| Target client: `cursor`, `claude`, `windsurf`, or `all` |
| `--client <client>` | Alias for `--target` |
| `-w, --write` | Merge and write directly to client configuration file on disk |
| `--bearer <token>` | Bearer token for client configuration environment |

### `postmcp presets [list|sync]`
Browse and synchronize the built-in preset catalog.

---

## Monorepo Packages

* `packages/core`: Spec parser, Token Diet engine, JIT dynamic router, safety classifier, macro orchestrator, and MCP protocol server (`@postmcp/core`).
* `packages/cli`: PostMCP command-line binary (`postmcp run`, `postmcp studio`, `postmcp export`, etc.).
* `packages/studio`: Next.js 16 + Turbopack local visual workbench (`@postmcp/studio`).
* `packages/presets`: 60+ pre-curated API configurations (`@postmcp/presets`).
* `packages/types`: Shared TypeScript definitions and interfaces (`@postmcp/types`).

---

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run unit tests across all packages
pnpm test

# Typecheck the entire monorepo
pnpm run typecheck
```

---

## License

MIT (c) [PostMCP Contributors](LICENSE)
