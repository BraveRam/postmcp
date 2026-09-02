import { NextResponse } from 'next/server';
import { generateText, tool, jsonSchema } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { applyTokenDiet, ResilientHttpClient } from '@postmcp/core';
import { NormalizedSpec, NormalizedOperation } from '@postmcp/types';

export function isPrivateOrBlockedHost(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    const hostname = parsed.hostname.toLowerCase();

    // Loopback, local, internal, cloud metadata
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname === '169.254.169.254' ||
      hostname === '0.0.0.0' ||
      hostname === '::1'
    ) {
      return true;
    }

    // IPv4 private/local range validation
    const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const octet1 = parseInt(ipv4Match[1], 10);
      const octet2 = parseInt(ipv4Match[2], 10);

      if (octet1 === 127) return true; // Loopback 127.0.0.0/8
      if (octet1 === 10) return true; // Private 10.0.0.0/8
      if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) return true; // Private 172.16.0.0/12
      if (octet1 === 192 && octet2 === 168) return true; // Private 192.168.0.0/16
      if (octet1 === 169 && octet2 === 254) return true; // Link-local / metadata 169.254.0.0/16
      if (octet1 === 100 && octet2 >= 64 && octet2 <= 127) return true; // CGNAT 100.64.0.0/10
      if (octet1 === 0) return true;
    }

    return false;
  } catch {
    return true;
  }
}

async function executeMcpOperation(
  op: NormalizedOperation,
  args: any,
  spec: NormalizedSpec,
  authConfig?: any,
  dryRun: boolean = true
) {
  const isMutation =
    op.method.toLowerCase() !== 'get' ||
    op.riskTier === 'MUTATION' ||
    op.riskTier === 'CRITICAL';

  // Safeguard: In Sandbox, mutations (POST, PUT, DELETE, PATCH) or dryRun=true are NEVER dispatched destructively to live production APIs
  if (dryRun || isMutation) {
    const mockItem: Record<string, any> = {
      id: args?.id || 'res_' + Math.floor(Math.random() * 100000),
      status: args?.status || 'success',
      ...args,
      _sandbox: {
        mode: 'DRY_RUN_SAFEGUARD',
        simulatedMethod: op.method.toUpperCase(),
        targetPath: op.path,
        riskTier: op.riskTier,
      },
      created_at: new Date().toISOString(),
    };

    const diet = applyTokenDiet([mockItem], {
      enabled: true,
      fieldMasks: spec.tokenDiet?.fieldMasks?.[op.path],
      convertToMarkdownTable: true,
    });

    const safeguardNotice = isMutation
      ? `\n\n> 🛡️ **[DRY RUN SAFEGUARD ACTIVE]**: Destructive mutation \`${op.method.toUpperCase()} ${op.path}\` (${op.riskTier}) simulated safely without modifying remote resources.`
      : '';

    return {
      operationId: op.id,
      status: 200,
      result: diet.text + safeguardNotice,
      savings: diet.savingsPercentage,
    };
  }

  // Safe Read-Only GET Execution with user-provided credentials
  const baseUrl = spec.servers?.[0]?.url;
  if (baseUrl && !baseUrl.includes('example.com') && authConfig) {
    // Enforce SSRF & Private Network Safeguard
    if (isPrivateOrBlockedHost(baseUrl)) {
      return {
        operationId: op.id,
        status: 403,
        result: `🛡️ **[SSRF Safeguard Blocked]**: Live GET requests to private or loopback host (${baseUrl}) are restricted in Web Studio.`,
        savings: 0,
      };
    }

    try {
      const client = new ResilientHttpClient({
        baseUrl,
        auth: authConfig,
        specSecuritySchemes: spec.securitySchemes,
        timeout: 10000,
        maxRetries: 1,
      });

      let pathUrl = op.path;
      const queryParams: Record<string, any> = {};

      if (op.parameters) {
        for (const p of op.parameters) {
          if (args[p.name] !== undefined) {
            if (p.in === 'path') {
              pathUrl = pathUrl.replace(`{${p.name}}`, encodeURIComponent(String(args[p.name])));
            } else if (p.in === 'query') {
              queryParams[p.name] = args[p.name];
            }
          }
        }
      }

      const res = await client.request({
        url: pathUrl,
        method: 'GET',
        params: Object.keys(queryParams).length > 0 ? queryParams : undefined,
      });

      const diet = applyTokenDiet(res.data, {
        enabled: true,
        fieldMasks: spec.tokenDiet?.fieldMasks?.[op.path],
        convertToMarkdownTable: true,
      });

      return {
        operationId: op.id,
        status: res.status,
        result: diet.text,
        savings: diet.savingsPercentage,
      };
    } catch (err: any) {
      return {
        operationId: op.id,
        status: 500,
        result: `Failed to fetch live GET endpoint: ${err.message}`,
        savings: 0,
      };
    }
  }

  // Default simulated execution
  const mockItem: Record<string, any> = {
    id: args?.id || 'res_' + Math.floor(Math.random() * 100000),
    status: 'active',
    ...args,
    created_at: new Date().toISOString(),
  };

  const diet = applyTokenDiet([mockItem], {
    enabled: true,
    fieldMasks: spec.tokenDiet?.fieldMasks?.[op.path],
    convertToMarkdownTable: true,
  });

  return {
    operationId: op.id,
    status: 200,
    result: diet.text,
    savings: diet.savingsPercentage,
  };
}

function resolveModelProvider(model: string, apiKey?: string): any {
  if (model.startsWith('claude')) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) return null;
    const anthropic = createAnthropic({ apiKey: key });
    const modelId = model === 'claude-3-5-sonnet' ? 'claude-3-5-sonnet-latest' : model;
    return anthropic(modelId);
  }

  if (model.startsWith('gemini')) {
    const key = apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!key) return null;
    const google = createGoogleGenerativeAI({ apiKey: key });
    const modelId = model === 'gemini-2-flash' ? 'gemini-2.0-flash-exp' : model;
    return google(modelId);
  }

  // Default to OpenAI provider
  const key = apiKey || process.env.OPENAI_API_KEY || process.env.AI_GATEWAY_TOKEN;
  if (!key) return null;
  const openai = createOpenAI({ apiKey: key });
  const modelId = model === 'gpt-4o' ? 'gpt-4o' : model === 'gpt-4o-mini' ? 'gpt-4o-mini' : 'gpt-4o';
  return openai(modelId);
}

export async function POST(request: Request) {
  try {
    const {
      messages,
      model = 'gpt-4o',
      apiKey,
      spec,
      selectedOperationId,
      authConfig,
      dryRun = true,
    } = await request.json();

    if (!spec || !Array.isArray(spec.operations)) {
      return NextResponse.json(
        { error: 'Valid OpenAPI spec required for sandbox simulation.' },
        { status: 400 }
      );
    }

    // Dynamically mount tools for active operations
    const dynamicTools: Record<string, any> = {};
    const operationsToMount: NormalizedOperation[] = spec.operations.slice(0, 15);

    let executedToolCall: { name: string; args: any } | undefined = undefined;
    let executedToolResult: { text: string; savings?: number } | undefined = undefined;

    for (const op of operationsToMount) {
      dynamicTools[op.id] = tool({
        description: op.description || op.summary || `Execute ${op.method.toUpperCase()} ${op.path}`,
        parameters: jsonSchema((op.inputSchema || { type: 'object', properties: {} }) as any),
        execute: async (args: any) => {
          executedToolCall = { name: op.id, args };
          const execRes = await executeMcpOperation(op, args, spec, authConfig, dryRun);
          executedToolResult = { text: execRes.result, savings: execRes.savings };
          return execRes;
        },
      } as any);
    }

    // 1. Live LLM Generation via Vercel AI SDK if provider credentials exist
    const selectedLanguageModel = resolveModelProvider(model, apiKey);

    if (selectedLanguageModel) {
      const result = await generateText({
        model: selectedLanguageModel,
        messages,
        tools: dynamicTools,
      });

      const toolName = (executedToolCall as any)?.name;
      return NextResponse.json({
        role: 'assistant',
        content: result.text || `Executed tool **${toolName || 'operation'}** successfully with ${model}.`,
        toolCall: executedToolCall,
        result: executedToolResult,
      });
    }

    // 2. Offline / Simulated Intelligent Agent Mode
    const lastUserMessage = messages[messages.length - 1]?.content || 'Execute test';
    const targetOp =
      (selectedOperationId &&
        spec.operations.find((o: NormalizedOperation) => o.id === selectedOperationId)) ||
      spec.operations[0];

    const mockArgs: Record<string, any> = {};
    if (targetOp.parameters) {
      for (const p of targetOp.parameters.slice(0, 2)) {
        mockArgs[p.name] = p.name.includes('id')
          ? 'obj_882910'
          : p.name.includes('email')
          ? 'user@example.com'
          : 'sample_val';
      }
    }

    const execRes = await executeMcpOperation(targetOp, mockArgs, spec, authConfig, dryRun);

    return NextResponse.json({
      role: 'assistant',
      content: `I analyzed your request "${lastUserMessage}" and dispatched tool **\`${targetOp.id}\`** on the **${spec.title}** MCP server with Token Diet active.`,
      toolCall: {
        name: targetOp.id,
        args: mockArgs,
      },
      result: {
        text: execRes.result,
        savings: execRes.savings,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Sandbox execution failed.' },
      { status: 500 }
    );
  }
}
