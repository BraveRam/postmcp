# PostMCPSystem Architecture & Engineering Blueprint 
> **The "Postman for MCP"** — Universal, context-optimized, safe, type-safe Model Context Protocol (MCP) server engine, CLI, and Visual Studio for any OpenAPI / Swagger specification.

---

## 1. Executive Vision & Problem Statement

Connecting AI coding assistants (Cursor, Claude Desktop, Antigravity, Windsurf) to external REST APIs is fundamentally broken when using naive 1-to-1 OpenAPI-to-MCP converters:

1. **Context Window Explosion (The "Needle in a Haystack" Tool Problem)**:
   - Converting a 200-endpoint REST spec (e.g. Stripe, GitHub, Jira) injects 30,000+ tokens of static tool schemas on **every single LLM turn**.
   - This consumes the prompt context budget, degrades model reasoning, and causes severe tool-selection hallucinations.
2. **Token Drowning (Unbounded Payload Bloat)**:
   - Raw REST responses are packed with 50KB+ of redundant JSON metadata (HATEOAS `_links`, internal audit timestamps, tracking IDs, null properties).
   - This metadata floods the context window with low-signal noise, degrading downstream task completion.
3. **The CRUD Mismatch (Slow Round-Trip Chaining)**:
   - REST APIs are architected for web frontends with fine-grained CRUD endpoints (e.g. `GET /user?email=...` $\rightarrow$ `GET /user/:id/orders` $\rightarrow$ `POST /orders/:id/cancel`).
   - An AI agent is forced to make 3–5 slow, sequential round trips to satisfy one simple human prompt.
4. **Blind Mutation Risk (Data Loss & Security)**:
   - High-risk endpoints (`DELETE /database/wipe`, `POST /billing/charge`) are exposed with the same priority as `GET /status`, risking catastrophic unintended actions.

**PostMCP solves these core problems by acting as the intelligent compilation and runtime layer between OpenAPI and the Model Context Protocol.**

---

## 2. High-Level System Topology

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
│  - Presets (50+ APIs)     │     │  │    (Vercel AI Gateway)        │  │      export)                │  │     │  - Custom Python/TS Agents│
└───────────────────────────┘     │  │  - Real-Time Token Visualizer │  │  (stdio & Streamable HTTP)  │  │     └───────────────────────────┘
                                  │  └───────────────┬───────────────┘  └──────────────┬──────────────┘  │
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
                                  │                 │ 6. Media Adapter & Async 202     │                 │
                                  │                 │ 7. Resilient HTTP & Rate Limiter │                 │
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

## 3. Monorepo Structure

```
postmcp/
├── packages/
│   ├── core/                          # Core parsing, transformation, and runtime engine (@postmcp/core)
│   │   ├── src/
│   │   │   ├── parser/                # OpenAPI 2.0/3.0/3.1 AST parser & $ref dereferencer
│   │   │   │   ├── dereference.ts     # Circular $ref safe dereferencing graph walker
│   │   │   │   ├── normalizer.ts      # Schema & parameter normalizer, operationId cleaner
│   │   │   │   └── types.ts           # Internal NormalizedAST and ToolDefinition types
│   │   │   ├── tokendiet/             # Token compression and formatting engine
│   │   │   │   ├── prune.ts           # Null, empty, HATEOAS, and metadata pruner
│   │   │   │   ├── table.ts           # Homogeneous JSON array to Markdown table serializer
│   │   │   │   ├── mask.ts            # JSONPath field filtering engine
│   │   │   │   └── index.ts
│   │   │   ├── jit/                   # JIT dynamic tool discovery & routing
│   │   │   │   ├── indexer.ts         # In-memory BM25 lexical + semantic search index
│   │   │   │   ├── registry.ts        # Dynamic tool lifecycle & mounting manager
│   │   │   │   └── meta-tool.ts       # `tool_search` meta-tool definition
│   │   │   ├── safety/                # Risk tiers, confirmation tokens & dry-run
│   │   │   │   ├── classifier.ts      # READ_ONLY, MUTATION, CRITICAL risk tier analyzer
│   │   │   │   ├── dryrun.ts          # Request simulation & diff generator
│   │   │   │   └── guard.ts           # Execution gate & confirmation challenge generator
│   │   │   ├── macro/                 # Chained multi-step workflow runner
│   │   │   │   ├── executor.ts        # Step-by-step in-memory HTTP orchestrator
│   │   │   │   ├── template.ts        # Mustached `{{param}}` and JSONPath variable extractor
│   │   │   │   └── types.ts
│   │   │   ├── media/                 # Binary, PDF, CSV, and Image adapters
│   │   │   │   ├── image.ts           # Native MCP Image content block encoder for vision LLMs
│   │   │   │   ├── csv.ts             # CSV-to-Markdown table converter
│   │   │   │   └── binary.ts          # Temporary artifact file manager
│   │   │   ├── http/                  # Resilient HTTP client
│   │   │   │   ├── client.ts          # Axios/fetch wrapper with interceptors
│   │   │   │   ├── auth.ts            # Dynamic auth injector (Header, Bearer, API Key, Query)
│   │   │   │   ├── retry.ts           # Jittered exponential backoff (429/503) & Retry-After
│   │   │   │   └── async202.ts        # 202 Accepted auto-polling background state machine
│   │   │   ├── server/                # Official MCP SDK v2 Server implementation
│   │   │   │   ├── stdio.ts           # StdioServerTransport handler
│   │   │   │   ├── http.ts            # NodeStreamableHTTPServerTransport handler
│   │   │   │   └── runtime.ts         # Unified MCP server dispatcher
│   │   │   └── codegen/               # Standalone MCP server code generators
│   │   │       ├── python.ts          # Python FastMCP + Pydantic + httpx generator
│   │   │       └── typescript.ts      # TypeScript MCP SDK v2 + Zod generator
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── cli/                           # `postmcp` CLI binary executable
│   │   ├── src/
│   │   │   ├── commands/
│   │   │   │   ├── run.ts             # `postmcp run <spec>`
│   │   │   │   ├── studio.ts          # `postmcp studio` launcher
│   │   │   │   ├── inspect.ts         # `postmcp inspect <spec>` summary
│   │   │   │   ├── generate.ts        # `postmcp generate <spec>`
│   │   │   │   ├── presets.ts         # `postmcp presets list/sync`
│   │   │   │   └── export.ts          # `postmcp export <spec> --target cursor|claude`
│   │   │   └── index.ts               # Commander CLI entrypoint
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── studio/                        # Next.js 16 App Router visual studio with shadcn/ui (@postmcp/studio)
│       ├── src/
│       │   ├── app/                   # Workbench UI pages & API routes
│       │   ├── components/            # shadcn/ui components, spec tree, live sandbox, modals
│       │   └── lib/                   # Direct integration with @postmcp/core & Vercel AI SDK
│       ├── tsconfig.json
│       └── package.json
├── presets/                           # 50+ curated developer API configurations
│   ├── github.json
│   ├── stripe.json
│   ├── linear.json
│   ├── supabase.json
│   ├── slack.json
│   ├── sentry.json
│   ├── notion.json
│   ├── resend.json
│   └── ... (50+ presets)
├── tests/                             # Golden OpenAPI fixtures and end-to-end integration tests
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

---

## 4. Deep Component Specifications & Algorithms

### 4.1 AST Parser & $ref Dereferencing Engine (`packages/core/src/parser`)

The parser ingests Swagger 2.0, OpenAPI 3.0.x, and OpenAPI 3.1.x specs (from raw JSON, YAML strings, local files, or remote URLs) and produces a unified `NormalizedAST`.

#### Key Algorithms & Responsibilities:
1. **Circular `$ref` Graph Traversal**:
   - Maintains a visited pointer stack during schema dereferencing.
   - When a recursive reference is detected (e.g. `TreeNode -> children -> TreeNode`), recursion is safely broken at depth 2 by replacing the recursive reference with an inline stub:
     ```json
     {
       "type": "object",
       "description": "Recursive self-reference to TreeNode"
     }
     ```
2. **Deterministic Naming & OperationId Sanitization**:
   - If `operationId` is missing, generates a deterministic name: `${method}_${cleanPath}` (e.g., `POST /v1/billing/subscriptions` $\rightarrow$ `postV1BillingSubscriptions`).
   - Disambiguates duplicate operation IDs across tags by appending a deterministic path/method hash.
3. **Parameter Flattening**:
   - Merges path parameters (`/users/{id}`), query parameters (`?status=active`), header parameters, and JSON `requestBody` into a single flat-friendly JSON Schema for the LLM's `inputSchema`.
   - Polymorphic schemas (`oneOf`, `anyOf`, `allOf`) are collapsed into unified object representations with discriminator annotations in the field descriptions.

---

### 4.2 Adaptive Hybrid JIT Dynamic Tool Router (`packages/core/src/jit`)

To guarantee prompt context protection without sacrificing discoverability:

```
                          ┌──────────────────────────┐
                          │  OpenAPI Spec Ingested   │
                          └─────────────┬────────────┘
                                        │
                         Endpoint Count Threshold Check
                                        │
                ┌───────────────────────┴───────────────────────┐
                ▼ (<= 20 Endpoints)                             ▼ (> 20 Endpoints)
     ┌───────────────────────┐                       ┌───────────────────────┐
     │ Direct Tool Mode      │                       │ Adaptive JIT Mode     │
     │ Exposes all endpoints │                       │ Exposes ONLY          │
     │ as static MCP tools   │                       │ `tool_search` Meta    │
     └───────────────────────┘                       └───────────┬───────────┘
                                                                 │
                                                    LLM Calls `tool_search(query)`
                                                                 │
                                                                 ▼
                                                     ┌───────────────────────┐
                                                     │ BM25 In-Memory Match  │
                                                     │ (Top 3-5 Tools Found) │
                                                     └───────────┬───────────┘
                                                                 │
                                                                 ▼
                                                     ┌───────────────────────┐
                                                     │ Dynamic Tool Mounting │
                                                     │ Emit `list_changed`   │
                                                     │ Active context <1.5k  │
                                                     └───────────────────────┘
```

#### The JIT Lifecycle:
1. **Indexing Phase**:
   - On server startup, all endpoints are tokenized into an in-memory BM25 index across:
     - `name` / `operationId`
     - `summary` and `description`
     - `path` and HTTP `method`
     - `tags` and parameter names
2. **Search & Dynamic Mounting**:
   - When the LLM calls `tool_search({ query: "refund an invoice for a customer" })`:
   - OpenMCP scores all endpoints and retrieves the top 3–5 highest-scoring candidates (e.g. `createRefund`, `getInvoice`, `getCustomer`).
   - OpenMCP dynamically registers these tools and emits the standard MCP protocol notification `notifications/tools/list_changed`.
   - The LLM receives the precise tool definitions in its immediate context window and executes the targeted action.
3. **Active Context Budget**:
   - Ensures that even a 500-endpoint API consumes **under 1,500 tokens** of active context space.

---

### 4.3 Smart Adaptive Token Diet Engine (`packages/core/src/tokendiet`)

The Token Diet engine compresses REST API responses before returning them to the LLM:

#### 1. Recursive Null & Noise Stripper
- Recursively removes:
  - `null` and `undefined` keys
  - Empty strings `""`, empty objects `{}`, and empty arrays `[]`
  - Standard REST metadata: `_links`, `_embedded`, `href`, `links`, `etag`, `telemetry`, tracking identifiers.

#### 2. Adaptive JSON-to-Markdown Table Serialization
When an API response contains an array of uniform objects (e.g., list of customers, transactions, or repositories):
1. Samples the first 5 records to establish common column headers.
2. Formats all items into a compact, clean Markdown table.
3. Formats nested scalar objects (e.g. `{ currency: "USD", amount: 100 }`) as compact inline strings (`USD 100`).

```markdown
| id | name | email | status | created |
| :--- | :--- | :--- | :--- | :--- |
| cus_1 | Jane Doe | jane@example.com | active | 2026-01-15 |
| cus_2 | John Smith | john@example.com | delinquent | 2026-02-01 |
```

**Token Savings Benchmark**:
* Raw JSON (100 items): **~28,000 tokens**
* Token Diet Markdown Table: **~1,900 tokens** (**93.2% Token Reduction**)

#### 3. Token Capping & Continuation
- Default ceiling of **2,500 tokens** per response.
- If payload exceeds ceiling, truncates gracefully and appends pagination/continuation instructions.

---

### 4.4 3-Tier Safety Classifier & Mutation Guardrails (`packages/core/src/safety`)

Every operation in the spec is automatically categorized into a Risk Tier:

| Risk Tier | HTTP Methods / Patterns | MCP Annotations | Behavior & Guardrails |
| :--- | :--- | :--- | :--- |
| **Tier 1: `READ_ONLY`** | `GET`, `HEAD`, `OPTIONS` | `readOnlyHint: true`, `idempotentHint: true` | Fully autonomous execution without confirmation. |
| **Tier 2: `MUTATION`** | `POST`, `PUT`, `PATCH` (Standard writes) | `idempotentHint: false` | Normal write execution; audit logged with structured request/response traces. |
| **Tier 3: `CRITICAL`** | `DELETE` or matches `/(drop\|purge\|cancel\|terminate\|refund\|transfer\|auth\|admin)/i` | `destructiveHint: true` | Supports `--dry-run` simulation mode and `--safe-mode` flags. Returns execution simulation when dry-run is active. |

---

### 4.5 Resilient HTTP Client & Async 202 Auto-Polling (`packages/core/src/http`)

#### 1. Rate Limiting & Transient Retries (429 / 503)
- Implements jittered exponential backoff (retries up to 3 times).
- Automatically parses `Retry-After` headers (both integer seconds and HTTP-date formats).
- If retries are exhausted, returns an actionable error response to the LLM with exact cooldown timing:
  ```
  [Error 429] Rate limit reached for Linear API. Cooldown: 12 seconds remaining. Please wait before retrying.
  ```

#### 2. Smart Auto-Polling for `202 Accepted` Endpoints
When an API responds with `202 Accepted` (indicating a background job has been queued):
1. OpenMCP inspects the response for `Location` headers or JSON properties (`job_id`, `status_url`, `id`).
2. PostMCP polls the status endpoint in the background with exponential backoff ($500\text{ms} \rightarrow 1\text{s} \rightarrow 2\text{s}$, up to a 15-second timeout).
3. Once the job transitions to `completed` / `succeeded`, PostMCP returns the final result directly to the LLM in the same turn.

#### 3. Actionable Error Recovery
- HTTP errors (400, 401, 403, 404, 500) do **not** crash the MCP process.
- Returns `{ isError: true }` with structured text:
  ```
  API Request Failed [HTTP 400 Bad Request]
  - Endpoint: POST /v1/customers
  - Error: Missing required property 'email'
  - Suggestion: Re-call the tool providing the 'email' parameter.
  ```

---

### 4.6 Multi-Type Media & Binary Adapter (`packages/core/src/media`)

- **Images (`image/png`, `image/jpeg`, `image/webp`)**: Returns native MCP Image content blocks (`{ type: "image", data: base64, mimeType }`), allowing multimodal vision models (Claude 3.5 Sonnet, GPT-4o, Gemini 2.0) to analyze charts, generated images, or scanned documents directly.
- **CSVs (`text/csv`)**: Automatically parsed into clean Markdown tables.
- **PDFs & Raw Binaries**: Written to a temporary local artifact cache (`~/.postmcp/artifacts/`) and returned with clean file paths and clickable links.

---

### 4.7 Declarative Macro Workflow Chainer (`packages/core/src/macro`)

Allows developers and presets to bundle multi-step REST operations into high-level composite tools:

```json
{
  "macros": [
    {
      "name": "refundCustomerByEmail",
      "description": "Finds customer by email, fetches their latest charge, and executes a full refund",
      "parameters": {
        "type": "object",
        "properties": {
          "email": { "type": "string", "description": "Customer email" },
          "reason": { "type": "string", "description": "Reason for refund" }
        },
        "required": ["email"]
      },
      "steps": [
        {
          "id": "findCustomer",
          "action": "GET /v1/customers?email={{email}}",
          "export": { "customerId": "data[0].id" }
        },
        {
          "id": "getCharges",
          "action": "GET /v1/charges?customer={{customerId}}&limit=1",
          "export": { "chargeId": "data[0].id" }
        },
        {
          "id": "executeRefund",
          "action": "POST /v1/refunds",
          "body": { "charge": "{{chargeId}}", "reason": "{{reason}}" }
        }
      ]
    }
  ]
}
```

---

## 5. Visual Web Studio (`packages/studio`)

The Web Studio is a local **Next.js 16 App Router** (React 19, Turbopack) workbench styled with **Tailwind CSS** and **shadcn/ui** components, launched via `npx postmcp studio`:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PostMCP Visual Studio                                       [● 50+ Presets]│
├──────────────────────┬───────────────────────────────────────┬──────────────┤
│  API Explorer        │  Endpoint Detail & Token Diet Curator │ Live Sandbox │
├──────────────────────┼───────────────────────────────────────┼──────────────┤
│ ▼ Stripe API         │  POST /v1/refunds                     │ [Model: GPT4]│
│   GET  /v1/charges   │  Description: Create a charge refund  │              │
│   POST /v1/refunds   │  ───────────────────────────────────  │ User:        │
│   GET  /v1/customers │  Token Diet Field Mask:               │ Refund Jane  │
│                      │  [x] id  [x] amount  [x] status       │ Doe $50      │
│ ▼ Linear API         │  [ ] balance_transaction  [ ] receipt │              │
│   GET  /issues       │                                       │ Agent:       │
│   POST /issues       │  Token Comparison Preview:            │ [Tool Call]  │
│                      │  Raw: 14.2k toks ──► Diet: 420 toks   │ POST /refund │
│                      │  (-97.0% Token Savings)               │              │
│                      │                                       │ Result:      │
│                      │  [ 1-Click Copy Config for Cursor ]   │ Markdown Tbl │
└──────────────────────┴───────────────────────────────────────┴──────────────┘
```

### UI Architecture & shadcn/ui Component Suite:
The Studio is built with modern, accessible **shadcn/ui** components:
- **`Command` (cmdk)**: Instant fuzzy search and keyboard navigation across all API endpoints, tags, and tools.
- **`Accordion` / `Collapsible`**: Hierarchical API tree organized by OpenAPI tags, paths, and HTTP methods.
- **`Badge`**: Distinct color-coded badges for HTTP methods (`GET` emerald, `POST` blue, `PUT` amber, `DELETE` rose) and Safety Risk Tiers (`READ_ONLY`, `MUTATION`, `CRITICAL`).
- **`Switch` & `Checkbox`**: Interactive toggles to enable/disable tools and visually pick Token Diet field masks.
- **`Tabs`**: Seamless switching between *Endpoint Inspector*, *Token Diet Config*, *Macro Workflow Builder*, and *Live Sandbox*.
- **`Dialog` & `Drawer`**: High-polish Copyable Snippet Modal for 1-click `.cursor/mcp.json` / `claude_desktop_config.json` export.
- **`ScrollArea`**: Smooth virtualized scrolling for massive JSON schemas (e.g. Stripe/GitHub specs).
- **`Tooltip`**: Instant hover explanations for parameter validations, token calculation diffs, and risk hints.

### Key Studio Features:
1. **Drag & Drop / URL Spec Ingestion**: Ingests specs from local files, live URLs, or bundled presets.
2. **Visual Endpoint Checklist & Pruning**: Check/uncheck endpoints, rename tools, edit descriptions, and define JSONPath field masks.
3. **Live Sandbox with Vercel AI Gateway**: Powered by the Vercel AI SDK (`ai`), allowing live interactive testing with any LLM model.
4. **Real-Time Token Visualizer**: Displays side-by-side token counters (Raw REST JSON vs Token Diet Markdown).
5. **Copyable Snippet Modal**: Generates ready-to-use JSON snippets with 1-click copy buttons for `.cursor/mcp.json` and `claude_desktop_config.json`.
6. **Project Persistence**: Saves customization state directly into `postmcp.config.json` in the current workspace.

---

## 6. Complete 6-Command CLI Reference

| Command | Syntax | Description |
| :--- | :--- | :--- |
| **`run`** | `postmcp run <spec\|preset> [flags]` | Starts the MCP server on stdio or Streamable HTTP. Supports `--token-diet`, `--jit`, `--dry-run`, `--base-url`, `--header`, `--api-key`. |
| **`studio`** | `postmcp studio [--port 3333]` | Starts and launches the local visual workbench in the browser. |
| **`inspect`** | `postmcp inspect <spec\|preset>` | Analyzes a spec in the terminal: endpoint count, risk tiers, and estimated token savings. |
| **`generate`** | `postmcp generate <spec> --target <python\|typescript> -o <dir>` | Generates a standalone, type-safe Python (FastMCP) or TypeScript MCP server repository. |
| **`presets`** | `postmcp presets [list\|sync]` | Lists bundled presets or syncs new community presets from GitHub into `~/.postmcp/presets/`. |
| **`export`** | `postmcp export <spec\|preset> --target <cursor\|claude>` | Outputs ready-to-use JSON configuration snippets for IDE setup. |

---

## 7. Edge Case & Resolution Matrix

| Edge Case Category | Real-World Challenge | PostMCP Concrete Engineering Solution |
| :--- | :--- | :--- |
| **Circular `$ref` References** | Self-referencing schemas (e.g. `Folder -> items -> Folder`) cause infinite AST loops | Depth-limiting traversal; terminates recursion at depth 2 with a descriptive JSON Schema stub. |
| **Missing / Duplicate `operationId`** | Specs lack operation IDs or have naming collisions across paths | Deterministic fallback: `${method}_${cleanPath}` with duplicate resolution hashes. |
| **Complex Parameter Styles** | `style: form, explode: false`, deepObject queries (`filter[name]=val`) | RFC 6570 URI template engine with deep query serializer and clean flat schema representation. |
| **Auth Diversity** | Bearer tokens, Basic Auth, API Key headers, query param auth | Universal environment variable interpolation (`${STRIPE_KEY}`) + dynamic header injectors. |
| **Polymorphic Schemas** | `oneOf` / `anyOf` unions confuse LLM function-calling | Flattens unions into unified parameter objects with clear discriminator descriptions. |
| **High-Risk Endpoints** | Destructive deletes or accidental billing charges | 3-tier risk classification (`READ_ONLY`, `MUTATION`, `CRITICAL`) with `--dry-run` simulation mode. |
| **Rate Limits & Failures** | 429 Too Many Requests, 502/503 Gateways | Jittered exponential backoff with `Retry-After` parsing and structured agent feedback. |
| **Large Text / Markdown Blobs** | API returns raw HTML or markdown that exceeds context limits | Converts HTML to clean text, strips inline CSS/scripts, and caps long prose fields at 1,000 characters. |
| **Async Background Jobs** | Endpoints returning `202 Accepted` with job URLs | Automatic background polling with exponential backoff (up to 15s) returning final result in 1 call. |
| **Image & Media Responses** | Endpoints returning PNGs, PDFs, or CSVs | Returns native MCP Image content blocks for images, parses CSVs to Markdown, caches PDFs locally. |

---

## 8. Implementation Phases & Milestones

### Phase 1: Core Runtime Engine (`@postmcp/core`)
- [x] Implement OpenAPI 2.0 / 3.0 / 3.1 AST parser & circular `$ref` dereferencer.
- [x] Implement Smart Token Diet engine (null pruner, Markdown table generator, JSONPath masking).
- [x] Implement Adaptive Hybrid JIT Tool Router (in-memory BM25 index + dynamic mounting).
- [x] Implement 3-Tier Safety Classifier & `--dry-run` mode.
- [x] Implement Declarative Macro Workflow Chainer.
- [x] Implement Media Adapter (Image content blocks, CSV parser, PDF artifacts).
- [x] Implement Resilient HTTP client (Auth injection, 429 backoff, 202 auto-polling).
- [x] Implement MCP SDK v2 Stdio and Streamable HTTP server wrappers.

### Phase 2: CLI Binary (`packages/cli`)
- [x] Build `postmcp run <spec>` command.
- [x] Build `postmcp inspect <spec>` summary inspector.
- [x] Build `postmcp export <spec> --target cursor|claude` command.
- [x] Build `postmcp presets list/sync` command.
- [x] Package CLI for zero-install `npx postmcp` execution.

### Phase 3: Presets Catalog (`presets/`)
- [x] Curate 50+ optimized presets with pre-configured field masks and risk classifications (GitHub, Stripe, Linear, Supabase, Slack, Sentry, Notion, Resend, Shopify, etc.).

### Phase 4: Visual Web Studio (`packages/studio`)
- [x] Build Next.js 16 App Router workbench UI with React 19, Turbopack, and Tailwind CSS.
- [x] Implement complete shadcn/ui component suite (`Command`, `Accordion`, `Badge`, `Switch`, `Tabs`, `Dialog`, `ScrollArea`, `Tooltip`).
- [x] Build Spec Explorer & Visual Endpoint Checklist.
- [x] Build Live Sandbox powered by Vercel AI SDK & AI Gateway.
- [x] Build Real-Time Token Visualizer & Copyable Snippet Modal.

### Phase 5: Code Generators (`packages/core/src/codegen`)
- [x] Implement Python FastMCP + Pydantic + httpx generator.
- [x] Implement TypeScript MCP SDK v2 + Zod generator.
