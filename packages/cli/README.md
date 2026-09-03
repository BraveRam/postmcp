# @postmcp/cli

> **The "Postman for MCP"** - Turn any OpenAPI or Swagger specification into a context-optimized, safe, type-safe Model Context Protocol (MCP) server in seconds.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![MCP Compliant](https://img.shields.io/badge/MCP-100%25-green.svg)](https://modelcontextprotocol.io/)
[![npm package](https://img.shields.io/badge/npm-@postmcp/cli-red.svg)](https://www.npmjs.com/package/@postmcp/cli)

---

## Overview

`@postmcp/cli` is the command-line interface for the PostMCP ecosystem. It allows AI coding assistants (Cursor, Claude Desktop, Antigravity, Windsurf) to connect directly to any REST API with zero code and intelligent token optimization.

### Key Features

* **Zero-Code Runtime**: Mount any OpenAPI 3.0, 3.1, or Swagger 2.0 specification over stdio or Streamable HTTP.
* **Token Diet Engine**: Reduce prompt context payload size by 70% to 95% using response pruning and compact Markdown table serialization.
* **JIT Dynamic Routing**: Replace massive static tool catalogs with an on-demand `tool_search` meta-tool, keeping active prompt context under 1,500 tokens.
* **Safety Circuit Breaker**: Intercept destructive actions (`DELETE`, `POST /charge`) in `--dry-run` mode before modifying remote state.
* **Visual Web Studio**: Launch an interactive dark-mode workbench (`postmcp studio`) to curate endpoints, build macros, and test prompts in a live sandbox.
* **1-Click Exporter**: Generate ready-to-use client configurations for Cursor (`.cursor/mcp.json`), Claude Desktop, and Windsurf.
* **Standalone Code Generator**: Scaffold production-ready TypeScript or Python FastMCP servers.

---

## Installation

### Run Directly via npx (Zero Install)

```bash
npx @postmcp/cli <command> [options]
```

### Or Install Globally

```bash
npm install -g @postmcp/cli

# Now accessible as `postmcp`
postmcp --help
```

---

## Commands

### `postmcp run <spec>`

Start an MCP server from an OpenAPI URL, local file, or preset.

```bash
# Run any public OpenAPI spec with Token Diet and JIT tool search
postmcp run https://api.stripe.com/openapi.json \
  --header "Authorization: Bearer $STRIPE_SECRET_KEY" \
  --token-diet \
  --jit

# Run from a local OpenAPI file
postmcp run ./openapi.yaml --token-diet

# Run from a curated preset
postmcp run @github --bearer $GITHUB_TOKEN
```

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

---

### `postmcp studio [spec]`

Launch the visual web studio on `http://localhost:3000`.

```bash
postmcp studio
postmcp studio ./openapi.json
```

| Option | Description |
| :--- | :--- |
| `-p, --port <number>` | Port for the studio server (default: 3000) |
| `--no-open` | Start server without opening browser |

---

### `postmcp inspect <spec>`

Inspect an OpenAPI spec to analyze endpoints, risk tiers, and token counts.

```bash
postmcp inspect https://api.linear.app/openapi.json
```

| Option | Description |
| :--- | :--- |
| `--json` | Output machine-readable AST JSON |

---

### `postmcp generate <spec>`

Generate a standalone TypeScript or Python FastMCP server repository.

```bash
# Generate standalone TypeScript server
postmcp generate ./stripe.json --lang ts -o ./my-stripe-mcp

# Generate standalone Python FastMCP server
postmcp generate ./stripe.json --lang py -o ./my-stripe-mcp-py
```

| Option | Description |
| :--- | :--- |
| `-t, --target <lang>` | Target language: `ts` or `py` (default: `ts`) |
| `-l, --lang <lang>` | Alias for `--target` |
| `-o, --out <dir>` | Output directory |

---

### `postmcp export <spec>`

Generate client configuration snippets for Cursor, Claude Desktop, and Windsurf.

```bash
# Export and automatically write to .cursor/mcp.json
postmcp export @stripe --client cursor --write
```

| Option | Description |
| :--- | :--- |
| `-t, --target <client>` | Target client: `cursor`, `claude`, `windsurf`, or `all` |
| `--client <client>` | Alias for `--target` |
| `-w, --write` | Merge and write directly to configuration file on disk |
| `--bearer <token>` | Bearer token for client environment |

---

### `postmcp presets`

Browse and sync the built-in catalog of 60+ pre-curated API presets.

```bash
postmcp presets
postmcp presets finance
postmcp presets sync
```

---

## 1-Click Cursor Setup (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "linear": {
      "command": "npx",
      "args": ["-y", "@postmcp/cli", "run", "https://api.linear.app/openapi.json", "--token-diet", "--jit"],
      "env": {
        "LINEAR_API_KEY": "${env:LINEAR_API_KEY}"
      }
    }
  }
}
```

---

## Related Packages

* [`@postmcp/core`](https://www.npmjs.com/package/@postmcp/core): Core parsing, transformation, and runtime engine.
* [`@postmcp/presets`](https://www.npmjs.com/package/@postmcp/presets): 60+ pre-curated developer API presets.
* [`@postmcp/studio`](https://www.npmjs.com/package/@postmcp/studio): Visual Web Studio.
* [`@postmcp/types`](https://www.npmjs.com/package/@postmcp/types): Shared TypeScript types.

---

## License

MIT (c) [PostMCP Contributors](https://github.com/BraveRam/postmcp/blob/main/LICENSE)
