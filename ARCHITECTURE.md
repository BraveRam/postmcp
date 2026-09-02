# PostMCP System Architecture & Engineering Blueprint 📮⚡
> **The "Postman for MCP"** — Universal, context-optimized, type-safe Model Context Protocol (MCP) server engine, CLI, and Visual Studio for any OpenAPI / Swagger specification.

---

## 1. Executive Vision & Core Philosophy

Connecting AI coding assistants (Cursor, Claude Desktop, Antigravity, Windsurf) to external REST APIs is broken when using naive 1-to-1 OpenAPI-to-MCP converters:
1. **Context Window Explosion**: Converting a 200-endpoint spec (e.g. Stripe or GitHub) injects 30,000+ tokens of static tool schemas on *every single LLM turn*, crushing prompt capacity and inducing tool-selection hallucinations.
2. **Token Drowning**: Raw REST responses contain 50KB+ of redundant JSON metadata (HATEOAS links, internal audit timestamps, null values), quickly filling the context window.
3. **CRUD Mismatch**: Fine-grained CRUD endpoints force the agent to execute 3–5 round trips for a single logical intent.
4. **Blind Mutation Risk**: High-risk endpoints (`DELETE /database`, `POST /billing/charge`) are exposed with zero confirmation gates or simulation capabilities.

**PostMCP solves this by acting as the intelligent compilation and runtime layer between OpenAPI and the Model Context Protocol.**

```
                                  ┌──────────────────────────────────────────────────────────────────────┐
                                  │                       PostMCP SUITE ARCHITECTURE                     │
                                  ├──────────────────────────────────────────────────────────────────────┤
                                  │                                                                      │
┌───────────────────────────┐     │  ┌───────────────────────────────┐  ┌─────────────────────────────┐  │     ┌───────────────────────────┐
│     OpenAPI Specs         │     │  │       Visual Web Studio       │  │        CLI Interface        │  │     │       Target Clients      │
│  - OpenAPI 3.0 / 3.1      │────►│  │     (Next.js + Tailwind)      │  │     `npx postmcp run`       │  │────►│  - Cursor (.cursor/mcp)   │
│  - Swagger 2.0            │     │  │  - Visual Spec Curator        │  │     `npx postmcp studio`    │  │     │  - Claude Desktop Config  │
│  - Local file / Live URL  │     │  │  - Live LLM Test Sandbox      │  │     `npx postmcp export`    │  │     │  - Antigravity / Windsurf │
└───────────────────────────┘     │  │    (Vercel AI Gateway)        │  │  (stdio & Streamable HTTP)  │  │     │  - Custom Python/TS Agents│
                                  │  └───────────────┬───────────────┘  └──────────────┬──────────────┘  │     └───────────────────────────┘
                                  │                  │                                 │                 │
                                  │                  └────────────────┬────────────────┘                 │
                                  │                                   ▼                                  │
                                  │                 ┌──────────────────────────────────┐                 │
                                  │                 │       packages/core Engine       │                 │
                                  │                 ├──────────────────────────────────┤                 │
                                  │                 │ 1. AST Parser & $ref Resolver    │                 │
                                  │                 │ 2. Adaptive Hybrid JIT Router    │                 │
                                  │                 │ 3. Smart Token Diet Engine       │                 │
                                  │                 │ 4. 3-Tier Safety & Dry-Run       │                 │
                                  │                 │ 5. Macro Workflow Chainer        │                 │
                                  │                 └─────────────────┬────────────────┘                 │
                                  │                                   │                                  │
                                  │         ┌─────────────────────────┴────────────────────────┐         │
                                  │         ▼                                                  ▼         │
                                  │  ┌─────────────────────────────┐            ┌──────────────────────┐ │
                                  │  │   Zero-Code Dynamic Proxy   │            │ Standalone Code Gen  │ │
                                  │  │  (In-Memory Dispatcher)     │            │ (Python FastMCP, TS) │ │
                                  │  └─────────────────────────────┘            └──────────────────────┘ │
                                  └──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Monorepo Structure

```
postmcp/
├── packages/
│   ├── core/                          # Core parsing, transformation, and runtime engine (@postmcp/core)
│   │   ├── src/
│   │   │   ├── parser/                # OpenAPI 2.0/3.0/3.1 AST parser & $ref dereferencer
│   │   │   ├── tokendiet/             # Field masking, null-stripping, JSON-to-Markdown tables
│   │   │   ├── jit/                   # JIT tool search & dynamic tool mounting registry
│   │   │   ├── safety/                # Risk tier classifier, dry-run sandbox, confirmation gates
│   │   │   ├── macro/                 # Multi-step chained workflow executor
│   │   │   ├── server/                # MCP SDK v2 stdio & Streamable HTTP transports
│   │   │   └── codegen/               # Template-based code generators (Python FastMCP, TypeScript)
│   │   └── package.json
│   ├── cli/                           # `postmcp` CLI binary (executable via npx postmcp)
│   │   ├── src/
│   │   │   ├── commands/              # run, studio, export, presets, inspect
│   │   │   └── index.ts
│   │   └── package.json
│   └── studio/                        # Next.js 15 App Router visual studio (@postmcp/studio)
│       ├── src/
│       │   ├── app/                   # Web studio workbench pages
│       │   ├── components/            # Spec tree, Live Sandbox (Vercel AI SDK), Token Visualizer, Modals
│       │   └── lib/                   # Direct integration with @postmcp/core
│       └── package.json
├── presets/                           # Curated top 50 developer API configurations
│   ├── github.json
│   ├── stripe.json
│   ├── linear.json
│   ├── supabase.json
│   ├── slack.json
│   └── ... (50+ presets)
├── tests/                             # Integration tests and golden OpenAPI test suites
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

---

## 3. Core Architectural Specifications & Design Decisions

### 3.1 Adaptive Hybrid JIT Tool Router
* **Endpoint Threshold**:
  * $\le 20$ endpoints: Directly advertises all operations as static tools with full descriptions and schemas.
  * $> 20$ endpoints: Automatically switches to dynamic JIT routing, advertising a single `tool_search(query, tag?)` meta-tool.
* **Dynamic Tool Mounting**:
  * On `tool_search({ query: "refund charge" })`, matches the top 3–5 most relevant endpoints using an in-memory BM25 + keyword search index.
  * Dynamically registers the matching tools and emits the standard `notifications/tools/list_changed` MCP event.
  * Ensures LLM active context stays strictly **under 1,500 tokens** regardless of API spec size.

### 3.2 Smart Adaptive Token Diet Engine
* **Null & Noise Pruning**: Automatically strips `null`, `undefined`, empty strings, empty arrays/objects, HATEOAS `_links`, tracking metadata, and internal audit timestamps.
* **Adaptive JSON-to-Markdown Table Conversion**:
  * Automatically detects lists/arrays of homogeneous objects and renders them as concise GitHub-flavored Markdown tables.
  * **Result**: **70% to 90% token reduction** per response with significantly higher LLM parsing accuracy.
* **Token Capping**: Enforces a default 2,500 token ceiling per tool response with clear pagination/continuation indicators.

### 3.3 3-Tier Safety Classification & Guardrails
* **Tier 1: `READ_ONLY`** (`GET`, `HEAD`, `OPTIONS`) — annotated with `readOnlyHint: true, idempotentHint: true`; executes autonomously.
* **Tier 2: `MUTATION`** (`POST`, `PUT`, `PATCH`) — normal write operations with structured audit trails.
* **Tier 3: `CRITICAL`** (`DELETE`, destructive operations matching `/(drop|purge|cancel|terminate|refund|transfer|auth|admin)/i`) — annotated with `destructiveHint: true`; supports `--dry-run` simulation mode and `--safe-mode` flags.

### 3.4 Universal Auth & Parameter Normalization
* **Auth**: Supports CLI flags (`--header`, `--bearer`, `--api-key`), environment variable substitution (`${STRIPE_KEY}`), and local `.env` loader in Studio.
* **Parameter Normalization**: LLMs receive clean, flat JSON Schemas. PostMCP auto-serializes nested objects, array delimiters (`style: form, explode: false`), deepObject query params (`filter[name]=val`), and multipart/form-data.

### 3.5 Declarative Macro Tools (Chained Workflows)
* Define multi-step HTTP workflows in `postmcp.config.json` with templated variables and JSONPath exports:
  ```json
  {
    "macros": [
      {
        "name": "refundCustomerByEmail",
        "description": "Finds customer by email, refunds their latest charge, and returns receipt",
        "parameters": {
          "email": { "type": "string", "description": "Customer email address" }
        },
        "steps": [
          { "action": "GET /v1/customers?email={{email}}", "export": { "customerId": "data[0].id" } },
          { "action": "GET /v1/charges?customer={{customerId}}&limit=1", "export": { "chargeId": "data[0].id" } },
          { "action": "POST /v1/refunds", "body": { "charge": "{{chargeId}}" } }
        ]
      }
    ]
  }
  ```

### 3.6 Studio Live Sandbox with Vercel AI Gateway
* Powered by the **Vercel AI SDK** (`ai`), allowing users to test generated tools interactively against any LLM provider (Anthropic, OpenAI, Google Gemini, Groq, Mistral, Ollama) via Vercel AI Gateway or direct provider keys.
* Real-time token counter displays raw REST response tokens vs. Token Diet tokens side-by-side.
* 1-Click Copyable Snippet Modal for instant copy-paste into `.cursor/mcp.json` or `claude_desktop_config.json`.

---

## 4. Implementation Roadmap

### Phase 1: Core Engine (`packages/core`)
- [ ] OpenAPI 2.0 / 3.0 / 3.1 parser with circular reference protection.
- [ ] Smart Token Diet engine (null stripping, JSONPath field masking, Markdown table generator).
- [ ] Adaptive Hybrid JIT Tool Router (BM25 search + dynamic tool mounting).
- [ ] 3-Tier Safety Classifier & `--dry-run` simulation mode.
- [ ] Declarative Macro Workflow Chainer.
- [ ] MCP SDK v2 stdio & Streamable HTTP server implementation.

### Phase 2: CLI Binary (`packages/cli`)
- [ ] `postmcp run <spec>` command.
- [ ] `postmcp studio` launcher.
- [ ] `postmcp export` and `postmcp presets sync` commands.
- [ ] Zero-install `npx postmcp` distribution setup.

### Phase 3: Presets Catalog (`presets/`)
- [ ] Top 50 curated API configurations (GitHub, Linear, Stripe, Supabase, Slack, Sentry, Notion, etc.).

### Phase 4: Visual Web Studio (`packages/studio`)
- [ ] Next.js 15 + Tailwind dark-mode workbench.
- [ ] Drag-and-drop spec dropzone and preset explorer.
- [ ] Live Sandbox with Vercel AI Gateway + real-time Token Diet visualizer.
- [ ] Copyable configuration snippet modal.

### Phase 5: Code Generators (`packages/core/src/codegen`)
- [ ] Python FastMCP + Pydantic generator.
- [ ] TypeScript MCP SDK v2 + Zod generator.
