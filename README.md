# PostMCP

> **The "Postman for MCP"** — Turn any OpenAPI / Swagger spec into a context-optimized, safe, type-safe Model Context Protocol (MCP) server in under 60 seconds.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![MCP Compliant](https://img.shields.io/badge/MCP-100%25-green.svg)](https://modelcontextprotocol.io/)
[![npm package](https://img.shields.io/badge/npm-postmcp-red.svg)](https://www.npmjs.com/package/postmcp)

---

## Quickstart (Zero Code)

Connect any REST API directly to **Claude Desktop**, **Cursor**, **Antigravity**, or **Windsurf**:

```bash
# Run any OpenAPI spec on the fly with Token Diet and JIT tool search
npx postmcp run https://api.stripe.com/openapi.json \
  --header "Authorization: Bearer $STRIPE_SECRET_KEY" \
  --token-diet \
  --jit
```

### Launch the Visual Web Studio

```bash
npx postmcp studio
```

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

## Why PostMCP?

Standard naive OpenAPI-to-MCP converters dump 100+ raw endpoints into the LLM context window and return 50KB JSON payloads, causing context overflows and hallucinated tool calls. 

**PostMCP solves this with 5 core pillars:**

1. **JIT Dynamic Tool Router (`tool_search`)**: Automatically switches to dynamic tool discovery for APIs with > 20 endpoints, preventing context window saturation (<1,500 active tokens).
2. **Token Diet Engine**: Prunes nulls/links/boilerplate and automatically formats object arrays into compact Markdown tables (**reducing payload tokens by 70%+**).
3. **3-Tier Risk Guardrails**: Tags operations with MCP hints (`readOnlyHint`, `destructiveHint`) and supports `--dry-run` simulation mode.
4. **Composite Macro Tools**: Chained multi-step REST workflows executed in memory in a single tool call.
5. **Visual Web Studio**: Dark-mode Next.js 16 + shadcn/ui workbench with Live Sandbox (Vercel AI Gateway) and copyable config snippets.

---

## Monorepo Structure

- `packages/core`: Spec parser, Token Diet engine, JIT router, and MCP SDK v2 protocol server (`@postmcp/core`).
- `packages/cli`: `postmcp` CLI executable (`postmcp run`, `postmcp studio`, `postmcp export`).
- `packages/studio`: Next.js 16 + shadcn/ui local workbench for visual endpoint curation and live sandbox testing.
- `presets/`: Curated, token-dieted configs for the top 50 developer APIs (GitHub, Linear, Stripe, Supabase, Slack, etc.).

---

## License

MIT © [PostMCP Contributors](LICENSE)
