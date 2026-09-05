# PostMCP

Turn any OpenAPI or Swagger specification into a fast, context-optimized, safe Model Context Protocol (MCP) server for your AI coding agents.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![MCP Compliant](https://img.shields.io/badge/MCP-100%25-green.svg)](https://modelcontextprotocol.io/)
[![npm package](https://img.shields.io/badge/npm-@postmcp/cli-red.svg)](https://www.npmjs.com/package/@postmcp/cli)

---

## Why PostMCP?

AI coding assistants (OpenCode, Cursor, Claude Desktop, Windsurf) are great at writing code, but giving them direct access to external APIs usually means writing hundreds of lines of custom MCP server boilerplate by hand.

Even if you auto-convert an OpenAPI spec naively, you hit immediate problems:
* **Context Bloat**: A 200-endpoint API injects tens of thousands of tokens into every turn, exhausting context limits and causing hallucinations.
* **Token Drowning**: Raw API responses return massive JSON payloads full of nulls, URLs, and internal metadata your LLM does not need.
* **Auth Confusion**: Every API has different credential headers, query formats, and auth schemes.

PostMCP solves this out of the box:
1. **Inspect any API in seconds**: Point to any OpenAPI URL, file, or preset to instantly see its endpoints, risk levels, and exact authentication requirements.
2. **Zero-Code Execution**: Run an in-memory MCP server over standard stdio or Streamable HTTP.
3. **Token Diet**: Automatically strips boilerplate and turns large JSON arrays into concise Markdown tables, cutting token consumption by 70% to 95%.
4. **Adaptive JIT Routing**: Scales to massive specs (e.g. Stripe, GitHub) by keeping tool definitions under 1,500 active tokens and loading endpoints on demand.
5. **Dry-Run Protection**: Intercepts destructive mutations (POST, PUT, DELETE) before they touch production systems.

---

## Quickstart in 3 Steps

### Step 1: Inspect the API

Before connecting an API to your agent, inspect it to verify its endpoints and authentication requirements:

```bash
npx @postmcp/cli inspect https://raw.githubusercontent.com/firecrawl/firecrawl/refs/heads/main/apps/api/openapi.json
```

Or inspect one of the 60+ built-in presets:

```bash
npx @postmcp/cli inspect @stripe
```

The output gives you an immediate summary:
* Total operations and HTTP methods.
* Base API URL.
* Security schemes and exact credential requirements.
* Estimated token savings with Token Diet.

---

### Step 2: Understand Authentication (How to Pass Keys)

Every API authenticates differently. PostMCP makes it easy to know what to pass. When you run `postmcp inspect`, check the **Security Schemes** and **Authentication Guide** in the output.

There are three common authentication patterns:

#### Pattern A: Bearer Token (`bearerAuth` or `HTTP bearer`)
Common services: Firecrawl, Stripe, GitHub, OpenAI, Supabase, Neon.

* **What it means**: The API expects an HTTP `Authorization: Bearer <token>` header.
* **How to pass via CLI**:
  ```bash
  npx @postmcp/cli run <spec-url> --bearer $MY_API_KEY
  ```
* **How to pass via Environment Variables**:
  PostMCP automatically checks for `BEARER_TOKEN` or `API_KEY` in your environment.
  ```bash
  export BEARER_TOKEN="your-token-here"
  npx @postmcp/cli run <spec-url>
  ```

#### Pattern B: Custom Header or Query API Key (`apiKey`)
Common services: Weather APIs, older enterprise gateways, custom services.

* **What it means**: The key is sent in a custom header (e.g. `X-API-Key: <token>`) or query parameter (e.g. `?api_key=<token>`).
* **Finding the exact parameter name**:
  Run `npx @postmcp/cli inspect <spec-url> --json` and look at the `securitySchemes` block.
* **How to pass via CLI**:
  * For headers:
    ```bash
    npx @postmcp/cli run <spec-url> -H "X-API-Key: your-token-here"
    ```
    or
    ```bash
    npx @postmcp/cli run <spec-url> --api-key "X-API-Key=your-token-here"
    ```
  * For query parameters:
    ```bash
    npx @postmcp/cli run <spec-url> --api-key "query:api_key=your-token-here"
    ```

#### Pattern C: Built-in Presets
If you are using a preset (like `@neon`, `@supabase`, `@github`, or `@stripe`), PostMCP already knows the exact token names:

| Preset | Built-in Env Variable | Description |
| :--- | :--- | :--- |
| `@neon` | `NEON_API_KEY` | Serverless Postgres management |
| `@supabase` | `SUPABASE_ACCESS_TOKEN` | Supabase Cloud management |
| `@stripe` | `STRIPE_SECRET_KEY` | Stripe Payments & Billing |
| `@github` | `GITHUB_TOKEN` | GitHub REST API |
| `@linear` | `LINEAR_API_KEY` | Linear Project Management |
| `@slack` | `SLACK_BOT_TOKEN` | Slack Web API |

---

### Step 3: Connect to Your AI Coding Assistant

Configure PostMCP in your editor's MCP settings.

#### OpenCode (`~/.config/opencode/opencode.json`)

```json
{
  "mcp": {
    "firecrawl": {
      "type": "local",
      "enabled": true,
      "command": [
        "npx",
        "-y",
        "@postmcp/cli@latest",
        "run",
        "https://raw.githubusercontent.com/firecrawl/firecrawl/refs/heads/main/apps/api/openapi.json",
        "--token-diet"
      ],
      "environment": {
        "BEARER_TOKEN": "{env:FIRECRAWL_API_KEY}"
      }
    },
    "neon": {
      "type": "local",
      "enabled": true,
      "command": [
        "npx",
        "-y",
        "@postmcp/cli@latest",
        "run",
        "@neon",
        "--token-diet"
      ],
      "environment": {
        "NEON_API_KEY": "{env:NEON_API_KEY}"
      }
    }
  }
}
```

#### Cursor (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "stripe": {
      "command": "npx",
      "args": [
        "-y",
        "@postmcp/cli@latest",
        "run",
        "@stripe",
        "--token-diet",
        "--jit"
      ],
      "env": {
        "STRIPE_SECRET_KEY": "${env:STRIPE_SECRET_KEY}"
      }
    }
  }
}
```

#### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@postmcp/cli@latest",
        "run",
        "@supabase",
        "--token-diet"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "your-access-token"
      }
    }
  }
}
```

---

## Core Features & Flags

### 1. Token Diet (`--token-diet`)
Raw API responses often return nested objects with dozens of unused properties, audit logs, and null values.

When `--token-diet` is enabled:
* Null and undefined values are automatically removed.
* Redundant links, ETags, and metadata are pruned.
* Arrays of records are converted into clean GitHub-flavored Markdown tables.
* Output size is reduced by up to 90%, preventing context overflows and keeping responses legible for LLMs.

### 2. Just-In-Time (JIT) Dynamic Router (`--jit`)
When an API exposes more than 20 endpoints (or hundreds, like Stripe and GitHub), exposing all tools statically overwhelms the LLM.

When `--jit` is enabled:
* PostMCP pre-mounts root discovery operations and an intelligent `tool_search` meta-tool.
* When the agent needs a specialized endpoint, it searches for it (e.g. `tool_search({ query: "refund charge" })`).
* Matched tools are mounted dynamically into memory and the MCP client is notified.
* Active prompt context stays below 1,500 tokens regardless of API size.

### 3. Dry-Run Safety Mode (`--dry-run`)
Allows your agent to test complex, multi-step workflows without making real changes:
* Read-only operations (`GET`, `HEAD`) execute against live APIs.
* Mutations (`POST`, `PUT`, `DELETE`, `PATCH`) are intercepted locally.
* PostMCP returns realistic simulated success responses annotated with `[DRY RUN SAFEGUARD ACTIVE]`.

### 4. Custom Headers (`-H`, `--header`)
Pass any custom headers required by your proxy, API gateway, or company infrastructure:

```bash
npx @postmcp/cli run ./my-spec.json \
  -H "X-Organization-Id: org_123" \
  -H "X-Workspace: staging"
```

---

## Visual Web Studio

PostMCP includes a local visual studio for inspecting APIs, testing endpoints, designing multi-step macros, and testing prompts in an interactive AI sandbox.

Launch the studio with:

```bash
npx @postmcp/cli studio
```

Or open a specific spec directly:

```bash
npx @postmcp/cli studio https://raw.githubusercontent.com/firecrawl/firecrawl/refs/heads/main/apps/api/openapi.json
```

Navigate to `http://localhost:3000` to:
* Search and browse all operations with risk-tier classification.
* Configure custom field masks and preview token savings in real time.
* Build composite multi-step macros.
* Test tool calls inside the live LLM sandbox.
* Export ready-to-use configuration files for Cursor, Claude Desktop, and OpenCode with one click.

---

## Standalone Code Generation

If you prefer to deploy an independent, self-contained MCP server instead of running PostMCP as a dynamic proxy, you can generate clean source code in TypeScript or Python:

```bash
# Generate a standalone TypeScript MCP server project
npx @postmcp/cli generate @stripe --lang ts -o ./stripe-mcp-ts

# Generate a standalone Python FastMCP project
npx @postmcp/cli generate @stripe --lang py -o ./stripe-mcp-py
```

The generated project includes:
* Native MCP tool handlers.
* Typed Pydantic models (Python) or Zod schemas (TypeScript).
* Ready-to-run test suite and Dockerfile.

---

## CLI Reference

```text
Usage: postmcp <command> [options]

Commands:
  run <spec>         Start an MCP server from an OpenAPI spec, URL, or @preset
  studio [spec]      Launch the local visual web studio (Next.js + Turbopack)
  inspect <spec>     Analyze an API spec, security schemes, and estimated token savings
  generate <spec>    Generate standalone TypeScript or Python MCP server code
  export <spec>      Generate configuration snippets for Cursor, Claude, or Windsurf
  presets [action]   List and browse the 60+ built-in API presets
```

### Options for `postmcp run`

| Flag | Description |
| :--- | :--- |
| `--token-diet` | Enable automatic response pruning and Markdown table conversion |
| `--jit` | Enable dynamic JIT tool discovery to save context tokens |
| `--bearer <token>` | Pass an HTTP Bearer token |
| `--api-key <key>` | Pass an API key (e.g. `X-API-Key=value` or `query:key=value`) |
| `-H, --header <k:v>` | Forward custom HTTP header to upstream requests (can be repeated) |
| `--dry-run` | Intercept and simulate destructive mutations |
| `-t, --transport <type>`| Transport protocol: `stdio` (default) or `http` |
| `-p, --port <port>` | Port for HTTP transport mode (default: 3000) |
| `--base-url <url>` | Override the default upstream API base URL |
| `--config <path>` | Path to a custom `postmcp.config.json` file |

---

## Monorepo Architecture

PostMCP is organized as a modular TypeScript monorepo managed with `pnpm` and `turbo`:

* `packages/core`: Spec parsing, token diet transformation, dynamic JIT tool routing, and runtime HTTP dispatching (`@postmcp/core`).
* `packages/cli`: The `postmcp` command-line tool (`@postmcp/cli`).
* `packages/presets`: Pre-tuned configurations and field masks for 60+ popular developer APIs (`@postmcp/presets`).
* `packages/studio`: Local visual workbench built on Next.js 16 and Turbopack (`@postmcp/studio`).
* `packages/types`: Shared TypeScript interfaces across all packages (`@postmcp/types`).

---

## Contributing & Local Development

```bash
# Clone the repository
git clone https://github.com/BraveRam/postmcp.git
cd postmcp

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run unit tests across all packages
pnpm test

# Run type checking
pnpm run typecheck
```

---

## License

MIT (c) [PostMCP Contributors](LICENSE)
