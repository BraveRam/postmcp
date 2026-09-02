# OpenMCP System Architecture & Engineering Blueprint 🚀
> **The "Postman for MCP"** — Universal, context-optimized, type-safe Model Context Protocol (MCP) server engine, CLI, and Visual Studio for any OpenAPI / Swagger specification.

---

## 1. Executive Vision & Core Philosophy

Connecting AI coding assistants (Cursor, Claude Desktop, Antigravity, Windsurf) to external REST APIs is broken when using naive 1-to-1 OpenAPI-to-MCP converters:
1. **Context Window Explosion**: Converting a 200-endpoint spec (e.g. Stripe or GitHub) injects 30,000+ tokens of static tool schemas on *every single LLM turn*, crushing prompt capacity and inducing tool-selection hallucinations.
2. **Token Drowning**: Raw REST responses contain 50KB+ of redundant JSON metadata (HATEOAS links, internal audit timestamps, null values), quickly filling the context window.
3. **CRUD Mismatch**: Fine-grained CRUD endpoints force the agent to execute 3–5 round trips for a single logical intent.
4. **Blind Mutation Risk**: High-risk endpoints (`DELETE /database`, `POST /billing/charge`) are exposed with zero confirmation gates or simulation capabilities.

**OpenMCP solves this by acting as the intelligent compilation and runtime layer between OpenAPI and the Model Context Protocol.**

```
                                  ┌──────────────────────────────────────────────────────────────────────┐
                                  │                       OpenMCP SUITE ARCHITECTURE                     │
                                  ├──────────────────────────────────────────────────────────────────────┤
                                  │                                                                      │
┌───────────────────────────┐     │  ┌───────────────────────────────┐  ┌─────────────────────────────┐  │     ┌───────────────────────────┐
│     OpenAPI Specs         │     │  │       Visual Web Studio       │  │        CLI Interface        │  │     │       Target Clients      │
│  - OpenAPI 3.0 / 3.1      │────►│  │     (Next.js + Tailwind)      │  │     `npx openmcp run`       │  │────►│  - Cursor (.cursor/mcp)   │
│  - Swagger 2.0            │     │  │  - Visual Spec Curator        │  │     `npx openmcp studio`    │  │     │  - Claude Desktop Config  │
│  - Local file / Live URL  │     │  │  - Live LLM Test Sandbox      │  │     `npx openmcp export`    │  │     │  - Antigravity / Windsurf │
└───────────────────────────┘     │  │  - Real-Time Token Counter    │  │  (stdio & Streamable HTTP)  │  │     │  - Custom Python/TS Agents│
                                  │  └───────────────┬───────────────┘  └──────────────┬──────────────┘  │     └───────────────────────────┘
                                  │                  │                                 │                 │
                                  │                  └────────────────┬────────────────┘                 │
                                  │                                   ▼                                  │
                                  │                 ┌──────────────────────────────────┐                 │
                                  │                 │       packages/core Engine       │                 │
                                  │                 ├──────────────────────────────────┤                 │
                                  │                 │ 1. AST Parser & $ref Resolver    │                 │
                                  │                 │ 2. JIT Dynamic Tool Router       │                 │
                                  │                 │ 3. Token Diet & Markdown Table   │                 │
                                  │                 │ 4. Safety Guardrails & Dry-Run   │                 │
                                  │                 │ 5. Macro Workflow Chainer        │                 │
                                  │                 └─────────────────┬────────────────┘                 │
                                  │                                   │                                  │
                                  │         ┌─────────────────────────┴────────────────────────┐         │
                                  │         ▼                                                  ▼         │
                                  │  ┌─────────────────────────────┐            ┌──────────────────────┐ │
                                  │  │   Zero-Code Dynamic Proxy   │            │ Standalone Code Gen  │ │
                                  │  │  (In-Memory Dispatcher)     │            │ (Python TS Go Rust)  │ │
                                  │  └─────────────────────────────┘            └──────────────────────┘ │
                                  └──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Monorepo Structure

```
openapi-to-mcp/
├── packages/
│   ├── core/                          # Core parsing, transformation, and runtime engine
│   │   ├── src/
│   │   │   ├── parser/                # OpenAPI 2.0/3.0/3.1 AST parser & $ref dereferencer
│   │   │   ├── tokendiet/             # Field masking, null-stripping, JSON-to-Markdown tables
│   │   │   ├── jit/                   # JIT tool search & dynamic tool mounting registry
│   │   │   ├── safety/                # Risk tier classifier, dry-run sandbox, confirmation gates
│   │   │   ├── macro/                 # Multi-step chained workflow executor
│   │   │   ├── server/                # MCP SDK v2 stdio & Streamable HTTP transports
│   │   │   └── codegen/               # Template-based code generators (Python, TypeScript)
│   │   └── package.json
│   ├── cli/                           # `openmcp` CLI binary (executable via npx)
│   │   ├── src/
│   │   │   ├── commands/              # run, studio, export, presets, inspect
│   │   │   └── index.ts
│   │   └── package.json
│   └── studio/                        # Next.js 15 App Router visual studio
│       ├── src/
│       │   ├── app/                   # Web studio workbench pages
│       │   ├── components/            # Spec tree, Live Sandbox, Token Counter, 1-Click Exporters
│       │   └── lib/                   # Direct integration with @openmcp/core
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

## 3. Detailed Component Deep-Dive

### 3.1 AST Parser & Schema Normalizer (`packages/core/src/parser`)
- **Multi-Format Support**: Parses JSON and YAML for Swagger 2.0, OpenAPI 3.0.x, and OpenAPI 3.1.x.
- **Robust Dereferencing**:
  - Handles local internal references (`#/components/schemas/User`), file references (`./models.yaml#/User`), and remote HTTP references (`https://schema.org/User`).
  - Detects and neutralizes **circular `$ref` graphs** by replacing infinite loops with a shallow stub or JSON Schema `$ref` alias.
- **Schema Sanitization**:
  - Cleans `operationId` into idiomatic, readable tool names (`v1_users_get_by_id` $\rightarrow$ `getUserById`).
  - Combines path parameters, query parameters, header parameters, and JSON `requestBody` into a single, unified, flat-friendly JSON Schema for the LLM tool input.
  - Flattens redundant `allOf`, `anyOf`, and `oneOf` unions into standard schemas compatible with tool-calling LLMs.

### 3.2 JIT Dynamic Tool Router (`packages/core/src/jit`)
When an API spec contains more than $N$ endpoints (default: 20 endpoints), static registration causes context bloating. The JIT Tool Router activates:
1. **Meta-Tool Registration**: Only a single meta-tool `tool_search(query: string, tag?: string)` is statically advertised to the client.
2. **Semantic & Keyword Indexing**: At server boot, all endpoints are indexed using an in-memory BM25 + trigram lexical matcher (with optional local vector embeddings).
3. **Dynamic Tool Mounting (`notifications/tools/list_changed`)**:
   - When the agent calls `tool_search({ query: "refund invoice" })`, OpenMCP matches the top 3–5 most relevant endpoints (e.g. `createRefund`, `getInvoice`, `cancelSubscription`).
   - OpenMCP dynamically registers these 3 tools and emits a `notifications/tools/list_changed` MCP notification.
   - The LLM receives the precise tool definitions in its immediate context window and executes the targeted action.
4. **Tool Eviction / LRU**: Dynamically unmounts inactive tools when context limits are reached.

### 3.3 Token Diet Engine (`packages/core/src/tokendiet`)
API responses are optimized before returning to the model:
1. **Structural Pruning**:
   - Strips out `null`, `undefined`, empty strings, and empty objects/arrays.
   - Removes standard boilerplate noise (e.g., `_links`, `href`, `links`, pagination cursor blobs, telemetry metadata).
2. **JSONPath Field Masking**:
   - Developers or presets can specify explicit field masks per endpoint:
     ```yaml
     paths:
       /v1/customers:
         get:
           diet:
             fields: ["id", "email", "name", "subscriptions.data[0].status", "currency"]
     ```
3. **Adaptive JSON-to-Markdown Table Conversion**:
   - Detects lists/arrays of homogeneous objects and converts them into compact Markdown tables.
   - **Token Savings**: A 100-item customer array in raw JSON takes ~25,000 tokens. As a Markdown table, it takes ~2,200 tokens (**91% token reduction**).
4. **Payload Truncation & Chunking**:
   - Enforces a configurable token cap per response (default: 2,500 tokens). If an API response exceeds this, OpenMCP safely truncates with a summary header and offers a `fetch_next_page` or `get_full_record` pointer.

### 3.4 Safety Classifier & Mutation Guardrails (`packages/core/src/safety`)
Every operation is assigned a Risk Tier:
* **Tier 1: `READ_ONLY`** (Safe)
  - `GET`, `HEAD`, `OPTIONS`.
  - Annotated with `readOnlyHint: true`, `idempotentHint: true`.
  - Automatically approved for autonomous execution.
* **Tier 2: `MUTATION`** (Audited)
  - `POST`, `PUT`, `PATCH`.
  - Logs audit trace; captures before/after diffs if paired with GET.
* **Tier 3: `CRITICAL`** (Guarded)
  - `DELETE`, endpoints matching regex `/(drop|purge|cancel|terminate|refund|transfer|billing|auth|admin)/i`.
  - Annotated with `destructiveHint: true`.
  - **Dry-Run Mode**: Supports simulating requests against sandbox environments or returning planned HTTP payload summaries before sending.
  - **Confirmation Gate**: Returns an `execution_required` challenge token requiring explicit user confirmation.

### 3.5 Composite / Macro Workflow Chainer (`packages/core/src/macro`)
Solves the CRUD mismatch by allowing declarative multi-step workflows:
```yaml
macros:
  - name: refundAndNotifyCustomer
    description: "Finds customer by email, refunds their latest charge, and records a note."
    parameters:
      email: { type: string, description: "Customer email" }
      reason: { type: string, description: "Reason for refund" }
    steps:
      - id: findCustomer
        action: get /v1/customers?email={{email}}
        export: { customerId: "data[0].id" }
      - id: getCharges
        action: get /v1/charges?customer={{customerId}}&limit=1
        export: { chargeId: "data[0].id" }
      - id: createRefund
        action: post /v1/refunds
        body: { charge: "{{chargeId}}", reason: "{{reason}}" }
```
The agent calls **1 tool**, and OpenMCP executes all intermediate HTTP calls in memory with sub-millisecond latency.

### 3.6 Transport Layer & Protocol Conformance (`packages/core/src/server`)
- Built on the official **MCP TypeScript SDK v2** (`@modelcontextprotocol/server`).
- **stdio Transport**: Subprocess communication via stdin/stdout for desktop clients (Cursor, Claude Desktop, Antigravity, Windsurf).
- **Streamable HTTP Transport**: Modern stateless HTTP (`NodeStreamableHTTPServerTransport`) with CORS and DNS rebinding protection for cloud deployments.

---

## 4. Edge Cases & Concrete Solutions

| Edge Case Category | Challenge | OpenMCP Solution |
| :--- | :--- | :--- |
| **Circular `$ref` Pointers** | Schemas referencing themselves (e.g. `Folder -> items -> Folder`) cause infinite recursion. | AST parser tracks pointer traversal depth. Circular nodes are terminated at depth 2 with a JSON Schema `{ "type": "object", "description": "Recursive reference to Folder" }`. |
| **Missing / Duplicate `operationId`** | Specs with missing IDs or duplicates across paths. | Deterministic fallback naming: `${method}_${cleanPath}` (e.g. `get_api_v1_users_by_id`). Disambiguates duplicate IDs by appending tag/path hash. |
| **Complex Parameter Serialization** | OpenAPI query styles: `form`, `spaceDelimited`, `pipeDelimited`, `deepObject` (e.g. `filter[name]=foo`). | Built-in RFC 6570 URI template and query serializer supporting `explode: true/false`, CSV arrays, and nested query objects. |
| **Polymorphic Schemas (`anyOf` / `oneOf`)** | Confuses LLM function calling parsers. | Normalizes `oneOf` into a merged schema with optional union fields and a `discriminator` field annotation in the tool description. |
| **Authentication Variations** | Bearer tokens, Basic Auth, API Key headers (`X-API-Key`), query params (`?apiKey=`), OAuth2 refresh. | Flexible Auth Injector: reads environment variables (`${STRIPE_KEY}`), injects headers/query params, and supports dynamic token refresh handlers. |
| **File Uploads & Binary Payloads** | `multipart/form-data`, file downloads (PDF, images, zip). | Encodes binary file inputs as base64 or URI references. Automatically converts binary responses to MCP Image content or temporary local file artifacts with preview links. |
| **Rate Limiting & Transient Errors** | 429 Too Many Requests, 502/503 Gateway Errors. | Built-in exponential backoff retry with `Retry-After` header parsing and structured error messages informing the LLM of cooldown times. |
| **Large Text / Markdown Blobs in Responses** | API returns raw HTML or markdown that exceeds context limits. | Automatically converts HTML to clean text, strips inline CSS/scripts, and caps long prose fields at 1,000 characters with an ellipsis indicator. |
| **Case-Insensitive JIT Search** | LLM searches for "delete user" but spec uses `remove_account`. | JIT router uses synonym expansion, endpoint summary embedding, and fuzzy Levenshtein/BM25 scoring across tags, paths, and descriptions. |

---

## 5. Developer Experience (DX) & 60-Second Setup Flow

### Flow 1: Zero-Code Instant CLI (Cursor & Claude Desktop)
1. Developer runs:
   ```bash
   npx openmcp run https://api.linear.app/openapi.json --header "Authorization: Bearer $LINEAR_API_KEY"
   ```
2. Or adds 1 snippet to `.cursor/mcp.json`:
   ```json
   {
     "mcpServers": {
       "linear": {
         "command": "npx",
         "args": ["-y", "openmcp", "run", "https://api.linear.app/openapi.json", "--token-diet", "--jit"],
         "env": { "LINEAR_API_KEY": "${env:LINEAR_API_KEY}" }
       }
     }
   }
   ```
3. Agent immediately has full access to Linear tools with optimized token consumption.

### Flow 2: Visual Web Studio (`npx openmcp studio`)
1. User starts local studio: `npx openmcp studio` (opens `http://localhost:3333`).
2. **Drag & Drop** `swagger.yaml` or pick from **50+ Presets** (Stripe, GitHub, Supabase).
3. **Interactive Curator**: Check/uncheck endpoints, configure Token Diet field masks, test mock calls in the Live Sandbox.
4. **1-Click Export**: Click "Add to Cursor" or "Add to Claude Desktop" — the studio automatically updates the config files on disk.

### Flow 3: Code Generation (`openmcp generate`)
```bash
# Generate standalone Python FastMCP server
npx openmcp generate ./stripe-spec.json --target python --out ./stripe-mcp

# Generate standalone TypeScript server
npx openmcp generate ./linear-spec.yaml --target typescript --out ./linear-mcp
```

---

## 6. Implementation Roadmap

### Phase 1: Core Engine (`packages/core`)
- [ ] Implement OpenAPI 2.0 / 3.0 / 3.1 parser & dereferencer with circular reference safety.
- [ ] Implement Token Diet engine (null stripper, JSONPath field masking, JSON-to-Markdown table serializer).
- [ ] Implement JIT dynamic tool router & in-memory BM25 search index.
- [ ] Implement Safety Tiers & Risk Classifier.
- [ ] Implement MCP Server wrapper with `@modelcontextprotocol/server` (stdio & streamable HTTP).

### Phase 2: CLI Binary (`packages/cli`)
- [ ] Implement `openmcp run <spec>` command.
- [ ] Implement `openmcp export --target <cursor|claude>` command.
- [ ] Implement `openmcp inspect <spec>` summary inspector.
- [ ] Package CLI for zero-install `npx openmcp` execution.

### Phase 3: Presets Catalog (`presets/`)
- [ ] Curate 50+ optimized presets with pre-configured field masks and risk classifications (GitHub, Stripe, Linear, Supabase, Slack, Notion, Sentry, Resend, Shopify, etc.).
- [ ] Add 1-click preset launcher: `npx openmcp run preset:linear`.

### Phase 4: Visual Web Studio (`packages/studio`)
- [ ] Build Next.js 15 workbench UI with Tailwind CSS.
- [ ] Implement Drag & Drop spec ingestion + Preset Explorer.
- [ ] Build visual Endpoint Curator & Token Savings Visualizer.
- [ ] Build Live Sandbox tool tester.
- [ ] Add 1-click automatic config file writers for Cursor and Claude Desktop.

### Phase 5: Code Generators (`packages/core/src/codegen`)
- [ ] Python generator: FastMCP + Pydantic + httpx.
- [ ] TypeScript generator: `@modelcontextprotocol/server` + Zod + fetch.
- [ ] Architecture hook for future Go / Rust generator templates.
