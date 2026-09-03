# @postmcp/types

> **PostMCP Shared Types** - Unified TypeScript definitions and interfaces for the PostMCP ecosystem.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript 5.7+](https://img.shields.io/badge/TypeScript-5.7%2B-blue.svg)](https://www.typescriptlang.org/)
[![npm package](https://img.shields.io/badge/npm-@postmcp/types-purple.svg)](https://www.npmjs.com/package/@postmcp/types)

---

## Overview

`@postmcp/types` contains shared type definitions, interfaces, and enums used across all PostMCP packages (`@postmcp/core`, `@postmcp/cli`, `@postmcp/presets`, and `@postmcp/studio`).

---

## Installation

```bash
npm install -D @postmcp/types
# or
pnpm add -D @postmcp/types
```

---

## Core Types Exported

### 1. AST & Operation Definitions
* `NormalizedAST`: The parsed OpenAPI representation containing title, version, servers, and operations.
* `ToolDefinition`: Standardized MCP tool definition with JSON Schema input parameters.
* `RiskTier`: `'READ_ONLY' | 'MUTATION' | 'CRITICAL'`.

### 2. Token Diet & Optimization
* `TokenDietOptions`: Configuration for null stripping, metadata pruning, field masking, and Markdown table conversion.
* `TokenMetrics`: Token estimate before and after optimization with percentage saved.

### 3. Macro Pipelines
* `MacroDefinition`: Composite multi-step tool definition.
* `MacroStep`: Individual execution step in a macro workflow.

### 4. Configuration & CLI
* `PostMCPConfig`: Structure of `postmcp.config.json` workspace files.
* `RunCommandOptions`: Options for `postmcp run`.
* `StudioCommandOptions`: Options for `postmcp studio`.
* `GenerateCommandOptions`: Options for `postmcp generate`.
* `ExportCommandOptions`: Options for `postmcp export`.

---

## Usage Example

```typescript
import type { NormalizedAST, RiskTier, TokenDietOptions } from '@postmcp/types';

function analyzeSafety(tier: RiskTier): boolean {
  return tier === 'READ_ONLY';
}

const options: TokenDietOptions = {
  enableTable: true,
  stripNulls: true,
};
```

---

## License

MIT (c) [PostMCP Contributors](https://github.com/BraveRam/postmcp/blob/main/LICENSE)
