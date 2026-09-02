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
    const cookieParams: { originalName: string; pyName: string; type: string; required: boolean; desc?: string }[] = [];

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
        } else if (p.in === 'cookie') {
          cookieParams.push(item);
        } else {
          queryParams.push(item);
        }
      }
    }

    // 2. Collect request body schema (primitive, array, or object)
    let bodyType: string | null = null;
    let isBodyDirect = false; // true if primitive or array body (not wrapped in object)
    let isBodyRequired = false;

    if (op.inputSchema && op.inputSchema.properties && Object.keys(op.inputSchema.properties).length > 0) {
      const nonParamProperties: Record<string, any> = {};
      const knownParamNames = new Set((op.parameters || []).map((p) => p.name));

      for (const [propName, propSchema] of Object.entries<any>(op.inputSchema.properties)) {
        if (!knownParamNames.has(propName)) {
          nonParamProperties[propName] = propSchema;
        }
      }

      const nonParamKeys = Object.keys(nonParamProperties);

      // Check if this is a direct single primitive/array body property named 'requestBody' or 'body'
      if (
        nonParamKeys.length === 1 &&
        (nonParamKeys[0] === 'requestBody' || nonParamKeys[0] === 'body') &&
        (nonParamProperties[nonParamKeys[0]].type !== 'object' || !nonParamProperties[nonParamKeys[0]].properties)
      ) {
        const rawBodySchema = nonParamProperties[nonParamKeys[0]];
        bodyType = converter.convert(rawBodySchema, `${opTitle}Body`);
        isBodyDirect = true;
        isBodyRequired = (op.inputSchema.required || []).includes(nonParamKeys[0]);
      } else if (nonParamKeys.length > 0) {
        const bodySchema = {
          type: 'object',
          properties: nonParamProperties,
          required: (op.inputSchema.required || []).filter((r: string) => !knownParamNames.has(r)),
          description: op.inputSchema.description || `Request body for ${op.id}`,
        };
        bodyType = converter.generatePydanticModel(bodySchema, `${opTitle}RequestBody`);
        isBodyDirect = false;
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

    // Required cookies
    for (const p of cookieParams.filter((c) => c.required)) {
      const desc = p.desc ? `Field(description=${JSON.stringify(p.desc)})` : 'Field(...)';
      signatureArgs.push(`${p.pyName}: ${p.type} = ${desc}`);
    }

    // Body (if required)
    if (bodyType && isBodyRequired) {
      signatureArgs.push(`body: ${bodyType} = Field(..., description="Request body payload")`);
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

    // Optional cookies
    for (const p of cookieParams.filter((c) => !c.required)) {
      const desc = p.desc ? `Field(default=None, description=${JSON.stringify(p.desc)})` : 'Field(default=None)';
      signatureArgs.push(`${p.pyName}: Optional[${p.type}] = ${desc}`);
    }

    // Optional body
    if (bodyType && !isBodyRequired) {
      signatureArgs.push(`body: Optional[${bodyType}] = Field(default=None, description="Optional request body payload")`);
    }

    // 4. Build execution code
    const executionLines: string[] = [];

    // Dry run check
    executionLines.push('    if DRY_RUN:');
    executionLines.push(`        return f"[DRY-RUN] Simulating ${op.method.toUpperCase()} ${op.path} ({${JSON.stringify(op.riskTier || 'READ_ONLY')}})"`);

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

    if (cookieParams.length > 0) {
      executionLines.push('    req_cookies: dict[str, str] = {}');
      for (const p of cookieParams) {
        executionLines.push(`    if ${p.pyName} is not None:`);
        executionLines.push(`        req_cookies[${JSON.stringify(p.originalName)}] = str(${p.pyName})`);
      }
    }

    const headersArg = headerParams.length > 0 ? 'headers=req_headers' : 'headers=headers';
    const paramsArg = queryParams.length > 0 ? 'params=params if params else None' : 'params=None';
    const cookiesArg = cookieParams.length > 0 ? 'cookies=req_cookies if req_cookies else None' : 'cookies=None';

    let bodyArg = 'json=None';
    if (bodyType) {
      if (isBodyDirect) {
        // Direct primitive or array payload
        bodyArg = 'json=body if (isinstance(body, (dict, list)) or isinstance(body, (int, float, bool))) else None, content=str(body) if isinstance(body, str) else None';
      } else {
        // Pydantic model object
        bodyArg = 'json=body.model_dump(by_alias=True, exclude_none=True) if body else None';
      }
    }

    const toolFn = `
@mcp.tool()
async def ${fnName}(
    ${signatureArgs.join(',\n    ')}
) -> str:
    """
    ${docstring}
    """
${executionLines.join('\n')}
    async with httpx.AsyncClient(base_url=BASE_URL, ${headersArg}, ${cookiesArg}, timeout=30.0) as client:
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

  const safeTitle = (spec.title || 'MCP Server').replace(/"""/g, '\\"\\"\\"');
  const safeDescription = (spec.description || '').replace(/"""/g, '\\"\\"\\"');

  // Detect security schemes (Bearer, ApiKey header, Basic)
  const secSchemes = spec.securitySchemes || {};
  const primaryScheme = Object.values(secSchemes)[0] as any;
  let authHeaderCode = '';
  if (primaryScheme) {
    if (primaryScheme.type === 'http' && primaryScheme.scheme === 'bearer') {
      authHeaderCode = `if API_KEY:\n    headers["Authorization"] = f"Bearer {API_KEY}"`;
    } else if (primaryScheme.type === 'apiKey' && primaryScheme.in === 'header') {
      authHeaderCode = `if API_KEY:\n    headers[${JSON.stringify(primaryScheme.name)}] = API_KEY`;
    } else if (primaryScheme.type === 'http' && primaryScheme.scheme === 'basic') {
      authHeaderCode = `import base64\nif API_KEY:\n    headers["Authorization"] = f"Basic {base64.b64encode(API_KEY.encode()).decode()}"`;
    }
  }
  if (!authHeaderCode) {
    authHeaderCode = `if API_KEY:\n    headers["Authorization"] = f"Bearer {API_KEY}"`;
  }

  // 3. server.py
  files['server.py'] = `"""
${safeTitle} - FastMCP + Pydantic Server
${safeDescription}
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
DRY_RUN = os.getenv("DRY_RUN", "false").lower() in ("true", "1")

mcp = FastMCP(${JSON.stringify(spec.title)})

headers: dict[str, str] = {
    "User-Agent": "PostMCP-FastMCP/1.0",
    "Accept": "application/json",
}
${authHeaderCode}

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
DRY_RUN=false
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
