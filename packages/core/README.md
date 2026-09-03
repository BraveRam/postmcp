# @postmcp/core

> **PostMCP Core Engine** - OpenAPI parser, Token Diet optimizer, JIT dynamic router, safety guardrails, and Model Context Protocol (MCP) server.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![MCP Compliant](https://img.shields.io/badge/MCP-100%25-green.svg)](https://modelcontextprotocol.io/)
[![npm package](https://img.shields.io/badge/npm-@postmcp/core-blue.svg)](https://www.npmjs.com/package/@postmcp/core)

---

## Overview

`@postmcp/core` is the runtime and compilation engine that powers PostMCP. It provides programmatic APIs for parsing OpenAPI specifications, compressing JSON payloads via Token Diet, managing JIT dynamic tool discovery, and running compliant MCP servers over stdio or Streamable HTTP.

### Capabilities

1. **AST Parser & Resolver**: Circular-safe `$ref` dereferencing and schema normalization for OpenAPI 2.0 (Swagger), 3.0, and 3.1.
2. **Token Diet Engine**: JSON response pruning, field masking, and homogeneous array-to-Markdown table serialization (70%–95% token savings).
3. **Adaptive Hybrid JIT Router**: BM25 lexical + semantic search indexing for on-demand tool mounting (`tool_search`), keeping active tool definitions under 1,500 prompt tokens.
4. **Safety Circuit Breaker & Dry-Run**: 3-tier risk classification (`READ_ONLY`, `MUTATION`, `CRITICAL`) with mutation interception and simulation diffs.
5. **Macro Workflow Chainer**: Sequential multi-step request orchestration with JSONPath variable passing in server memory.
6. **Multimodal Media Adapters**: Automatic binary-to-image encoding (`image/png`, `image/jpeg`) as native MCP image blocks, CSV-to-Markdown conversion, and HTTP 202 async task polling.

---

## Installation

```bash
npm install @postmcp/core
# or
pnpm add @postmcp/core
```

---

## Programmatic Usage

### 1. Parse an OpenAPI Specification

```typescript
import { parseOpenApi } from '@postmcp/core';

const ast = await parseOpenApi('https://api.stripe.com/openapi.json');

console.log(`Loaded API: ${ast.title} (${ast.operations.length} endpoints)`);
```

### 2. Apply Token Diet Optimization to Payloads

```typescript
import { applyTokenDiet } from '@postmcp/core';

const rawApiResponse = [
  { id: 'usr_1', name: 'Alice', _links: { self: '/usr_1' }, meta: null },
  { id: 'usr_2', name: 'Bob', _links: { self: '/usr_2' }, meta: null },
];

const optimized = applyTokenDiet(rawApiResponse, {
  enableTable: true,
  stripNulls: true,
  stripLinks: true,
});

// Output is a clean, compact GitHub Markdown table:
// | id | name |
// | usr_1 | Alice |
// | usr_2 | Bob |
```

### 3. Start a PostMCP Server Programmatically

```typescript
import { createPostMcpServer } from '@postmcp/core';

const server = await createPostMcpServer({
  spec: 'https://api.linear.app/openapi.json',
  transport: 'stdio',
  tokenDiet: true,
  jit: true,
  headers: {
    Authorization: `Bearer ${process.env.LINEAR_API_KEY}`,
  },
});

await server.start();
```

---

## Architecture Components

* `src/parser`: OpenAPI 2.0/3.0/3.1 AST parser, parameter extractor, and recursive `$ref` resolver.
* `src/tokendiet`: Payload pruner, JSONPath masking engine, and Markdown table serializer.
* `src/jit`: In-memory BM25 indexer, tool registry, and `tool_search` meta-tool implementation.
* `src/safety`: Risk tier classifier, execution gate, and dry-run mutation interceptor.
* `src/macro`: Step-by-step in-memory workflow orchestrator with template interpolation.
* `src/media`: Image content encoder, CSV parser, and HTTP 202 async polling runner.
* `src/server`: Model Context Protocol server implementation supporting both `stdio` and Streamable HTTP.

---

## License

MIT (c) [PostMCP Contributors](https://github.com/BraveRam/postmcp/blob/main/LICENSE)
