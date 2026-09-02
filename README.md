# OpenMCP 🚀 (openapi-to-mcp)

> **The "Postman for MCP"** — Turn any OpenAPI / Swagger spec into a context-optimized, type-safe Model Context Protocol (MCP) server in under 60 seconds.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![MCP Compliant](https://img.shields.io/badge/MCP-100%25-green.svg)](https://modelcontextprotocol.io/)

---

## ⚡ Quickstart (Zero Code)

Run any OpenAPI spec directly in **Claude Desktop**, **Cursor**, or **Antigravity**:

```bash
# Run any OpenAPI spec on the fly
npx openmcp run https://api.stripe.com/openapi.json \
  --header "Authorization: Bearer $STRIPE_SECRET_KEY" \
  --token-diet \
  --jit
```

### Launch the Visual Web Studio

```bash
npx openmcp studio
```

---

## 🌟 Why OpenMCP?

Current naive OpenAPI-to-MCP converters dump 100+ raw endpoints into the LLM context window and return 50KB JSON payloads, causing context overflows and hallucinated tool calls. 

**OpenMCP solves this with 4 core innovations:**

1. 🔍 **JIT Tool Router (`tool_search`)**: Dynamically mounts only the 3–5 relevant tools needed for the user's intent instead of 100+ static tools.
2. 🥗 **Token Diet Engine**: JSONPath masking and automatic JSON-to-Markdown table formatting (reducing payload tokens by 70%+).
3. 🛡️ **Risk Guardrails**: Automatic risk-tier tagging (`READ_ONLY`, `MUTATION`, `CRITICAL`) with dry-run simulation mode.
4. 🎨 **Visual Web Studio**: Drag-and-drop OpenAPI workbench with 1-click export to `.cursor/mcp.json` and `claude_desktop_config.json`.

---

## 📦 Monorepo Structure

- `packages/core`: Spec parser, Token Diet engine, JIT router, and MCP JSON-RPC protocol server.
- `packages/cli`: `openmcp` CLI (`openmcp run`, `openmcp studio`, `openmcp export`).
- `packages/studio`: Next.js local workbench for visual endpoint curation and live sandbox testing.
- `presets/`: Curated, token-dieted configs for the top 50 developer APIs (GitHub, Linear, Stripe, Supabase, Slack, etc.).

---

## 📄 License

MIT © [OpenMCP Contributors](LICENSE)
