# PostMCP System Architecture & Engineering Blueprint 📮⚡
> **The "Postman for MCP"** — Universal, context-optimized, safe, type-safe Model Context Protocol (MCP) server engine, CLI, and Visual Studio for any OpenAPI / Swagger specification.

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
│  - OpenAPI 3.0 / 3.1      │────►│  │     (Next.js + Tailwind)      │  │     `npx postmcp <cmd>`     │  │────►│  - Cursor (.cursor/mcp)   │
│  - Swagger 2.0            │     │  │  - Visual Spec Curator        │  │     (run, studio, inspect,  │  │     │  - Claude Desktop Config  │
│  - Local file / Live URL  │     │  │  - Live LLM Test Sandbox      │  │      generate, presets,     │  │     │  - Antigravity / Windsurf │
└───────────────────────────┘     │  │    (Vercel AI Gateway)        │  │      export)                │  │     │  - Custom Python/TS Agents│
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
                                  │                 │ 6. Media Adapter & Rate Limiter  │                 │
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
│   │   │   ├── media/                 # Binary & media adapter (MCP Image content, CSV to MD, PDF cache)
│   │   │   ├── http/                  # HTTP client, auth injector, retry & 202 auto-polling
│   │   │   ├── server/                # MCP SDK v2 stdio & Streamable HTTP transports
│   │   │   └── codegen/               # Template-based code generators (Python FastMCP, TypeScript)
│   │   └── package.json
│   ├── cli/                           # `postmcp` CLI binary (executable via npx postmcp)
│   │   ├── src/
│   │   │   ├── commands/              # run, studio, inspect, generate, presets, export
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

## 3. Comprehensive Architectural Specifications

### 3.1 Adaptive Hybrid JIT Tool Router
* **Threshold**:
  * $\le 20$ endpoints: Directly advertises all operations as static tools with full descriptions and schemas.
  * $> 20$ endpoints: Automatically switches to dynamic JIT routing, advertising a single `tool_search(query: string, tag?: string)` meta-tool.
* **Dynamic Tool Mounting**:
  * Matches top 3–5 relevant endpoints via in-memory BM25 lexical + semantic index.
  * Emits MCP `notifications/tools/list_changed` event to mount matched tools dynamically.
  * Ensures LLM active context stays strictly **under 1,500 tokens** regardless of spec size.

### 3.2 Smart Adaptive Token Diet Engine
* **Null & Noise Pruning**: Automatically drops `null`, `undefined`, empty strings/arrays/objects, HATEOAS `_links`, and telemetry headers.
* **JSON-to-Markdown Tables**: Transforms homogeneous object arrays into compact GitHub-flavored Markdown tables (**70% to 90% token reduction**).
* **Token Capping & Status**: Caps responses at 2,500 tokens with continuation pointers.

### 3.3 3-Tier Safety Classification & Guardrails
* **Tier 1: `READ_ONLY`** (`GET`, `HEAD`) — `readOnlyHint: true, idempotentHint: true`; executes autonomously.
* **Tier 2: `MUTATION`** (`POST`, `PUT`, `PATCH`) — normal write operations with structured audit logging.
* **Tier 3: `CRITICAL`** (`DELETE`, destructive regex matches) — `destructiveHint: true`; supports `--dry-run` simulation and `--safe-mode`.

### 3.4 Media & Binary Response Adapter
* **Images (`image/png`, `image/jpeg`, `image/webp`)**: Returns native MCP Image content block (`{ type: "image", data: base64, mimeType }`) for vision LLMs.
* **CSVs**: Parsed directly into concise Markdown tables.
* **PDFs & Raw Binaries**: Saved to local temporary artifacts with returned file paths.

### 3.5 Network Resilience & Smart Async Polling
* **202 Accepted Background Jobs**: Automatically polls `Location` / job URL with exponential backoff (up to 15s) so the LLM receives the finished result in a single tool call.
* **Rate Limits & 503 Retries**: Jittered exponential backoff respecting `Retry-After` headers (up to 3 attempts) before returning actionable cooldown information.
* **Actionable Error Recovery**: Returns `{ isError: true }` with structured HTTP status, parsed error messages, and concrete parameter correction hints.

### 3.6 Transparent Smart Pagination
* Exposes `page`, `cursor`, `limit` (default: 20).
* Annotates response with item count and next-call instructions (e.g. *"Showing 20 of 145 items. To view more, call with page=2"*).

### 3.7 Base URL Resolution
1. CLI `--base-url <url>` flag.
2. `BASE_URL` or `<SERVICE>_BASE_URL` environment variables.
3. First URL in OpenAPI `servers[0].url`.
4. Visual dropdown switcher in Web Studio.

### 3.8 Declarative Macro Tools (Chained Workflows)
* Multi-step HTTP workflows defined in `postmcp.config.json` with templated parameters and JSONPath response exports.

### 3.9 Web Studio Live Sandbox & Exporter
* Powered by **Vercel AI SDK** (`ai`) with Vercel AI Gateway for universal model selection.
* Real-time Token Diet side-by-side comparison counter.
* Copyable Snippet Modal for 1-click copy-pasting into `.cursor/mcp.json` and `claude_desktop_config.json`.
* Saves configuration to local `postmcp.config.json` in workspace.

### 3.10 Presets Hub
* Top 50 presets bundled offline with the npm package.
* Dynamic sync via `postmcp presets sync` from GitHub into `~/.postmcp/presets/`.

---

## 4. Complete 6-Command CLI Suite

| Command | Usage | Description |
| :--- | :--- | :--- |
| **`postmcp run <spec>`** | `npx postmcp run ./api.yaml --token-diet --jit` | Launches high-performance stdio or HTTP MCP server. |
| **`postmcp studio`** | `npx postmcp studio --port 3333` | Launches local Next.js visual workbench. |
| **`postmcp inspect <spec>`** | `npx postmcp inspect https://api.linear.app/openapi.json` | Terminal summary of endpoints, risk tiers, and token diet savings. |
| **`postmcp generate <spec>`** | `npx postmcp generate ./api.json --target python -o ./server` | Generates standalone Python FastMCP or TypeScript MCP code. |
| **`postmcp presets`** | `npx postmcp presets list` / `sync` | Manages and synchronizes community API presets. |
| **`postmcp export <spec>`** | `npx postmcp export ./api.yaml --target cursor` | Outputs ready-to-use JSON config snippets for IDEs. |
