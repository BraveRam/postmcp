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
* `NormalizedSpec`: The parsed OpenAPI representation containing title, version, servers, and operations.
* `NormalizedOperation`: Standardized operation definition with JSON Schema input/response schemas and risk tier.
* `RiskTier`: `'READ_ONLY' | 'MUTATION' | 'CRITICAL'`.

### 2. Token Diet & Optimization
* `TokenDietOptions`: Configuration for null pruning, field masking, and Markdown table conversion.
* `TokenDietResult`: Output containing text, structured payload, token counts, and savings percentage.

### 3. Macro Pipelines
* `MacroDefinition`: Composite multi-step tool definition.
* `MacroStep`: Individual execution step in a macro workflow.

### 4. Configuration & CLI
* `PostMcpCliConfig`: Structure of `postmcp.config.json` workspace configuration files.
* `RunCommandOptions`: Options for `postmcp run`.
* `StudioCommandOptions`: Options for `postmcp studio`.
* `GenerateCommandOptions`: Options for `postmcp generate`.
* `ExportCommandOptions`: Options for `postmcp export`.

---

## Usage Example

```typescript
import type { NormalizedSpec, RiskTier, TokenDietOptions } from '@postmcp/types';

function analyzeSafety(tier: RiskTier): boolean {
  return tier === 'READ_ONLY';
}

const options: TokenDietOptions = {
  convertToMarkdownTable: true,
  maxTokens: 2500,
};
```

---

## License

MIT (c) [PostMCP Contributors](https://github.com/BraveRam/postmcp/blob/main/LICENSE)
