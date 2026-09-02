import { NormalizedSpec, NormalizedOperation, GeneratedProject } from '@postmcp/types';

const PYTHON_KEYWORDS = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
  'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
  'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
  'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try',
  'while', 'with', 'yield', 'type', 'id', 'format', 'list', 'dict',
  'str', 'int', 'float', 'bool', 'input', 'object', 'schema',
]);

export function toPythonIdentifier(name: string): string {
  let s = name
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .toLowerCase()
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!s || /^[0-9]/.test(s)) {
    s = `param_${s || 'value'}`;
  }

  if (PYTHON_KEYWORDS.has(s)) {
    s = `${s}_`;
  }

  return s;
}

export function toPascalCase(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9_]/g, '_');
  return clean
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('') || 'Model';
}

interface PydanticModelDefinition {
  name: string;
  code: string;
}

export class PythonSchemaConverter {
  private models: Map<string, PydanticModelDefinition> = new Map();
  private modelCounter: number = 0;

  public convert(schema: any, typeNameHint: string = 'Model'): string {
    if (!schema) return 'Any';

    if (schema.enum && Array.isArray(schema.enum) && schema.enum.length > 0) {
      const literals = schema.enum.map((val: any) => JSON.stringify(val)).join(', ');
      return `Literal[${literals}]`;
    }

    if (schema.type === 'string') {
      return 'str';
    }
    if (schema.type === 'integer') {
      return 'int';
    }
    if (schema.type === 'number') {
      return 'float';
    }
    if (schema.type === 'boolean') {
      return 'bool';
    }
    if (schema.type === 'array') {
      const itemType = schema.items ? this.convert(schema.items, `${typeNameHint}Item`) : 'Any';
      return `list[${itemType}]`;
    }
    if (schema.type === 'object' || schema.properties) {
      return this.generatePydanticModel(schema, typeNameHint);
    }

    if (schema.oneOf && Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
      const unionTypes = schema.oneOf.map((sub: any, idx: number) =>
        this.convert(sub, `${typeNameHint}Variant${idx + 1}`)
      );
      return `Union[${unionTypes.join(', ')}]`;
    }

    if (schema.anyOf && Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
      const unionTypes = schema.anyOf.map((sub: any, idx: number) =>
        this.convert(sub, `${typeNameHint}Option${idx + 1}`)
      );
      return `Union[${unionTypes.join(', ')}]`;
    }

    return 'Any';
  }

  public generatePydanticModel(schema: any, preferredName: string): string {
    const modelName = toPascalCase(preferredName);

    if (this.models.has(modelName)) {
      return modelName;
    }

    const properties = schema.properties || {};
    const requiredList = Array.isArray(schema.required) ? schema.required : [];
    const fields: string[] = [];

    // Register placeholder to avoid infinite recursion on circular schemas
    this.models.set(modelName, { name: modelName, code: '' });

    for (const [propKey, propSchema] of Object.entries<any>(properties)) {
      const pyFieldName = toPythonIdentifier(propKey);
      const isRequired = requiredList.includes(propKey);
      const fieldType = this.convert(propSchema, `${modelName}_${toPascalCase(propKey)}`);
      const desc = propSchema.description ? JSON.stringify(propSchema.description) : 'None';

      if (isRequired) {
        if (pyFieldName !== propKey) {
          fields.push(`    ${pyFieldName}: ${fieldType} = Field(..., alias=${JSON.stringify(propKey)}, description=${desc})`);
        } else {
          fields.push(`    ${pyFieldName}: ${fieldType} = Field(..., description=${desc})`);
        }
      } else {
        if (pyFieldName !== propKey) {
          fields.push(`    ${pyFieldName}: Optional[${fieldType}] = Field(default=None, alias=${JSON.stringify(propKey)}, description=${desc})`);
        } else {
          fields.push(`    ${pyFieldName}: Optional[${fieldType}] = Field(default=None, description=${desc})`);
        }
      }
    }

    if (fields.length === 0) {
      fields.push('    pass');
    }

    const doc = schema.description
      ? `    """${schema.description.replace(/"""/g, '\\"\\"\\"')}\"""\n`
      : '';

    const modelCode = `class ${modelName}(BaseModel):\n${doc}    model_config = ConfigDict(populate_by_name=True, extra="allow")\n\n${fields.join('\n')}`;

    this.models.set(modelName, { name: modelName, code: modelCode });
    return modelName;
  }

  public getGeneratedModelsCode(): string {
    return Array.from(this.models.values())
      .filter((m) => m.code)
      .map((m) => m.code)
      .join('\n\n');
  }
}

export function generatePythonProject(spec: NormalizedSpec): GeneratedProject {
  const files: Record<string, string> = {};

  const serverName = toPythonIdentifier(spec.title) || 'mcp_server';
  const baseUrl = spec.servers.length > 0 ? spec.servers[0].url : 'https://api.example.com';
  const converter = new PythonSchemaConverter();

  // Generate tools
  const toolFunctions: string[] = [];

  for (const op of spec.operations) {
    const fnName = toPythonIdentifier(op.id);
    const opTitle = toPascalCase(op.id);
    const docstring = (op.description || op.summary || `Execute ${op.id}`).replace(/"""/g, '\\"\\"\\"');

    // 1. Collect all parameters: path, query, header, cookie
    const pathParams: { originalName: string; pyName: string; type: string; required: boolean; desc?: string }[] = [];
    const queryParams: { originalName: string; pyName: string; type: string; required: boolean; desc?: string }[] = [];
    const headerParams: { originalName: string; pyName: string; type: string; required: boolean; desc?: string }[] = [];

    if (op.parameters) {
      for (const p of op.parameters) {
        const pyName = toPythonIdentifier(p.name);
        const pType = converter.convert(p.schema, `${opTitle}_Param_${toPascalCase(p.name)}`);
        const item = {
          originalName: p.name,
          pyName,
          type: pType,
          required: !!p.required,
          desc: p.description,
        };

        if (p.in === 'path') {
          pathParams.push(item);
        } else if (p.in === 'header') {
          headerParams.push(item);
        } else {
          queryParams.push(item);
        }
      }
    }

    // 2. Collect request body schema
    let bodyModelName: string | null = null;
    let isBodyRequired = false;

    if (op.inputSchema && op.inputSchema.properties && Object.keys(op.inputSchema.properties).length > 0) {
      // Find properties that are not already in path/query/header parameters
      const nonParamProperties: Record<string, any> = {};
      const knownParamNames = new Set((op.parameters || []).map((p) => p.name));

      for (const [propName, propSchema] of Object.entries<any>(op.inputSchema.properties)) {
        if (!knownParamNames.has(propName)) {
          nonParamProperties[propName] = propSchema;
        }
      }

      if (Object.keys(nonParamProperties).length > 0) {
        const bodySchema = {
          type: 'object',
          properties: nonParamProperties,
          required: (op.inputSchema.required || []).filter((r: string) => !knownParamNames.has(r)),
          description: op.inputSchema.description || `Request body for ${op.id}`,
        };
        bodyModelName = converter.generatePydanticModel(bodySchema, `${opTitle}RequestBody`);
        isBodyRequired = (bodySchema.required && bodySchema.required.length > 0) || false;
      }
    }

    // 3. Build tool function parameter signature
    const signatureArgs: string[] = [];

    // Path parameters always first and required
    for (const p of pathParams) {
      const desc = p.desc ? `Field(description=${JSON.stringify(p.desc)})` : 'Field(...)';
      signatureArgs.push(`${p.pyName}: ${p.type} = ${desc}`);
    }

    // Required query params
    for (const p of queryParams.filter((q) => q.required)) {
      const desc = p.desc ? `Field(description=${JSON.stringify(p.desc)})` : 'Field(...)';
      signatureArgs.push(`${p.pyName}: ${p.type} = ${desc}`);
    }

    // Required headers
    for (const p of headerParams.filter((h) => h.required)) {
      const desc = p.desc ? `Field(description=${JSON.stringify(p.desc)})` : 'Field(...)';
      signatureArgs.push(`${p.pyName}: ${p.type} = ${desc}`);
    }

    // Body model (if required)
    if (bodyModelName && isBodyRequired) {
      signatureArgs.push(`body: ${bodyModelName} = Field(..., description="Request body payload")`);
    }

    // Optional query params
    for (const p of queryParams.filter((q) => !q.required)) {
      const desc = p.desc ? `Field(default=None, description=${JSON.stringify(p.desc)})` : 'Field(default=None)';
      signatureArgs.push(`${p.pyName}: Optional[${p.type}] = ${desc}`);
    }

    // Optional headers
    for (const p of headerParams.filter((h) => !h.required)) {
      const desc = p.desc ? `Field(default=None, description=${JSON.stringify(p.desc)})` : 'Field(default=None)';
      signatureArgs.push(`${p.pyName}: Optional[${p.type}] = ${desc}`);
    }

    // Optional body model
    if (bodyModelName && !isBodyRequired) {
      signatureArgs.push(`body: Optional[${bodyModelName}] = Field(default=None, description="Optional request body payload")`);
    }

    // 4. Build execution code
    const executionLines: string[] = [];
    executionLines.push(`    url = ${JSON.stringify(op.path)}`);

    for (const p of pathParams) {
      executionLines.push(`    url = url.replace("{${p.originalName}}", str(${p.pyName}))`);
    }

    if (queryParams.length > 0) {
      executionLines.push('    params: dict[str, Any] = {}');
      for (const p of queryParams) {
        executionLines.push(`    if ${p.pyName} is not None:`);
        executionLines.push(`        params[${JSON.stringify(p.originalName)}] = ${p.pyName}`);
      }
    }

    if (headerParams.length > 0) {
      executionLines.push('    req_headers = dict(headers)');
      for (const p of headerParams) {
        executionLines.push(`    if ${p.pyName} is not None:`);
        executionLines.push(`        req_headers[${JSON.stringify(p.originalName)}] = str(${p.pyName})`);
      }
    }

    const headersArg = headerParams.length > 0 ? 'headers=req_headers' : 'headers=headers';
    const paramsArg = queryParams.length > 0 ? 'params=params if params else None' : 'params=None';
    const bodyArg = bodyModelName
      ? 'json=body.model_dump(by_alias=True, exclude_none=True) if body else None'
      : 'json=None';

    const toolFn = `
@mcp.tool()
async def ${fnName}(
    ${signatureArgs.join(',\n    ')}
) -> str:
    """
    ${docstring}
    """
${executionLines.join('\n')}
    async with httpx.AsyncClient(base_url=BASE_URL, ${headersArg}, timeout=30.0) as client:
        res = await client.request(
            method=${JSON.stringify(op.method.toUpperCase())},
            url=url,
            ${paramsArg},
            ${bodyArg},
        )
        res.raise_for_status()
        data = res.json() if res.headers.get("content-type", "").startswith("application/json") else res.text
        return format_token_diet(data)
`;

    toolFunctions.push(toolFn);
  }

  const generatedModelsCode = converter.getGeneratedModelsCode();

  // 1. requirements.txt
  files['requirements.txt'] = `mcp[cli]>=1.3.0
httpx>=0.28.1
pydantic>=2.10.0
python-dotenv>=1.0.1
`;

  // 2. pyproject.toml
  files['pyproject.toml'] = `[project]
name = "${serverName}"
version = "${spec.version || '1.0.0'}"
description = ${JSON.stringify(spec.description || `Standalone FastMCP server for ${spec.title}`)}
requires-python = ">=3.10"
dependencies = [
    "mcp[cli]>=1.3.0",
    "httpx>=0.28.1",
    "pydantic>=2.10.0",
    "python-dotenv>=1.0.1",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
`;

  // 3. server.py
  files['server.py'] = `"""
${spec.title} - FastMCP + Pydantic Server
Generated automatically by PostMCP (The Postman for MCP)
"""

import os
import json
from typing import Any, Optional, Union, Literal
from dotenv import load_dotenv
import httpx
from pydantic import BaseModel, Field, ConfigDict
from mcp.server.fastmcp import FastMCP

load_dotenv()

BASE_URL = os.getenv("BASE_URL", ${JSON.stringify(baseUrl)}).rstrip("/")
API_KEY = os.getenv("API_KEY", os.getenv("BEARER_TOKEN", ""))

mcp = FastMCP(${JSON.stringify(spec.title)})

headers: dict[str, str] = {
    "User-Agent": "PostMCP-FastMCP/1.0",
    "Accept": "application/json",
}
if API_KEY:
    headers["Authorization"] = f"Bearer {API_KEY}"

def format_token_diet(data: Any) -> str:
    """Format JSON responses efficiently for LLM context."""
    if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
        keys = list(data[0].keys())[:8]
        header_row = "| " + " | ".join(keys) + " |"
        sep_row = "| " + " | ".join(["---"] * len(keys)) + " |"
        rows = [header_row, sep_row]
        for item in data[:25]:
            rows.append("| " + " | ".join(str(item.get(k, "")).replace("\\n", " ") for k in keys) + " |")
        return "\\n".join(rows)
    if isinstance(data, (dict, list)):
        return json.dumps(data, indent=2)
    return str(data)

# --- Pydantic Data Models ---

${generatedModelsCode || '# No complex object models required for this spec.'}

# --- FastMCP Tool Endpoints ---
${toolFunctions.join('\n')}

if __name__ == "__main__":
    mcp.run()
`;

  // 4. README.md
  files['README.md'] = `# ${spec.title} MCP Server (Python FastMCP + Pydantic)

Standalone Model Context Protocol (MCP) server generated by **PostMCP** for **${spec.title}**.

## Prerequisites
- Python 3.10+
- [uv](https://docs.astral.sh/uv/) (recommended) or \`pip\`

## Quick Start

### 1. Install Dependencies
\`\`\`bash
# With uv (recommended)
uv sync

# Or with pip
pip install -r requirements.txt
\`\`\`

### 2. Configure Environment Variables
Copy \`.env.example\` to \`.env\` and fill in your API credentials:
\`\`\`bash
cp .env.example .env
\`\`\`

### 3. Run the MCP Server
\`\`\`bash
# Direct execution (stdio transport)
python server.py
# Or with uv
uv run server.py
\`\`\`

### 4. Test with MCP Inspector
\`\`\`bash
uv run mcp dev server.py
\`\`\`

### 5. Install to Claude Desktop
\`\`\`bash
uv run mcp install server.py
\`\`\`
`;

  // 5. .env.example
  files['.env.example'] = `BASE_URL=${baseUrl}
API_KEY=your_api_key_here
`;

  // 6. .gitignore
  files['.gitignore'] = `__pycache__/
*.py[cod]
*$py.class
.venv/
venv/
.env
.DS_Store
`;

  return { files };
}
