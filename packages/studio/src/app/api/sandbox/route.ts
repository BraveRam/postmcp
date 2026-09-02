import { NextResponse } from 'next/server';
import { generateText, tool, jsonSchema } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { applyTokenDiet, ResilientHttpClient } from '@postmcp/core';
import { NormalizedSpec, NormalizedOperation } from '@postmcp/types';

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
      // Fall back with error report
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

    const openAiApiKey = apiKey || process.env.OPENAI_API_KEY || process.env.AI_GATEWAY_TOKEN;

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

    // 1. Live LLM Generation via Vercel AI SDK if API key is provided
    if (openAiApiKey) {
      const openai = createOpenAI({ apiKey: openAiApiKey });

      const result = await generateText({
        model: openai(model === 'gpt-4o' ? 'gpt-4o' : 'gpt-4o-mini') as any,
        messages,
        tools: dynamicTools,
      });

      const toolName = (executedToolCall as any)?.name;
      return NextResponse.json({
        role: 'assistant',
        content: result.text || `Executed tool **${toolName || 'operation'}** successfully.`,
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
