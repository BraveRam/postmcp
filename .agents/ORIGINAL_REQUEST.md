# Original User Request

## 2026-09-02T08:10:10Z

This is a single self-contained fix; keep it small and focused. Complete Phase 1 implementation of `@postmcp/core` by resolving all 7 blocking review findings and 6 important findings, ensuring 100% MCP protocol compliance, strict security boundaries, robust HTTP/202 polling, and comprehensive test coverage.

Working directory: /home/plxor/code/expr/openapi-to-mcp
Integrity mode: development

## Requirements

### R1. Resolve Blocking Transport & Network Issues
- Replace legacy SSE transport with `NodeStreamableHTTPServerTransport` (or dedicated per-session transport handling) for Streamable HTTP server in `packages/core/src/server/http.ts`.
- Fix 202 background job polling for JSON arraybuffer bodies by decoding/parsing before status inspection.
- Propagate `isPollingTimeout: true` to `HttpResponseResult` when 202 polling times out.
- Fix request body serialization for `multipart/form-data` using standard `FormData` with valid boundaries.
- Support request bodies on `DELETE` operations according to OpenAPI 3.x specifications.

### R2. Enforce Security Schemes & Input Validation
- Implement OpenAPI `securitySchemes` and per-operation `security` enforcement (Bearer, API Key in header/query/cookie, Basic Auth) with parameter validation.
- Implement deep schema validation against `inputSchema` (types, enums, formats, array/object structure, additionalProperties) before request dispatch.
- Ensure macro interpolation safely URI-encodes query/path parameters and prevents SSRF / arbitrary host redirection.

### R3. Fix Spec Dereferencing, JIT LRU & Token Diet Edge Cases
- Support remote HTTP `$ref` fetching (`https://...#/...`) and relative dereferencing for nested external files.
- Fix JIT registry to use true LRU (promoting accessed tools) and ensure `tool_search` output accurately reflects mounted tools.
- Fix Token Diet truncation ceiling so `dietTokens <= maxTokens` holds strictly even for small limits (`maxTokens: 1`).
- Fix JSONPath field masking to preserve document shape and handle root-array expressions.
- Emit MCP annotations (`destructiveHint`, `readOnlyHint`, `idempotentHint`) for macro tools.

## Acceptance Criteria

### Verification & Protocol Conformance
- [ ] `turbo test` passes all unit and integration tests across parser, tokendiet, jit, safety, macro, http, and server.
- [ ] `turbo build` and `tsc --noEmit` succeed with zero errors.
- [ ] 202 polling test verifies that JSON status bodies trigger polling and timeouts set `isPollingTimeout: true`.
- [ ] Token Diet test verifies `applyTokenDiet(data, { maxTokens: 1 })` strictly honors the 1-token ceiling without crashing.
- [ ] JIT LRU test verifies tool access promotes tools and capacity eviction reflects actual active tools.
- [ ] Dry-run test verifies macro workflows and dangerous operations declare valid MCP annotations and produce complete simulations.
- [ ] Security test verifies per-operation security requirements and cross-origin credential stripping.
