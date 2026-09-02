import { NextResponse } from 'next/server';
import { createGateway, generateText, streamText, tool, jsonSchema } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
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

  // Safeguard: In Sandbox, mutations or dryRun=true are NEVER dispatched destructively to live production APIs
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
        result: `Access blocked by SSRF Safeguard: Private/Internal Host (${baseUrl}) is disallowed.`,
        savings: 0,
      };
    }

    try {
      const client = new ResilientHttpClient({
        baseUrl,
        auth: authConfig,
        timeout: 10000,
      });

      let targetUrl = op.path;
      if (args) {
        for (const [k, v] of Object.entries(args)) {
          targetUrl = targetUrl.replace(`{${k}}`, encodeURIComponent(String(v)));
        }
      }

      const res = await client.request({
        url: targetUrl,
        method: 'GET',
        params: args,
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

/**
 * Resolves the language model strictly through Vercel AI Gateway.
 */
function resolveVercelAiGatewayModel(model: string, apiKey?: string, customGatewayUrl?: string) {
  const key = apiKey || process.env.AI_GATEWAY_API_KEY || process.env.AI_GATEWAY_TOKEN || process.env.OPENAI_API_KEY;
  if (!key) return null;

  const rawUrl = customGatewayUrl || process.env.AI_GATEWAY_URL || 'https://ai-gateway.vercel.sh/v1';
  const baseURL = rawUrl.replace(/\/$/, '');

  try {
    const gateway = createGateway({
      apiKey: key,
      baseURL: baseURL.endsWith('/ai') ? baseURL : `${baseURL}/ai`,
    });
    return gateway(model);
  } catch {
    const gateway = createOpenAI({
      baseURL,
      apiKey: key,
    });
    return gateway(model);
  }
}

export async function POST(request: Request) {
  try {
    const {
      messages,
      model = 'zai/glm-5.3-flash',
      apiKey,
      gatewayUrl,
      spec,
      selectedOperationId,
      authConfig,
      dryRun = true,
      stream = false,
    } = await request.json();

    if (!spec || !Array.isArray(spec.operations)) {
      return NextResponse.json(
        { error: 'Valid OpenAPI spec required for sandbox simulation.' },
        { status: 400 }
      );
    }

    // Dynamically mount tools for active operations
    const dynamicTools: Record<string, any> = {};
    const operationsToMount: NormalizedOperation[] = spec.operations.slice(0, 20);

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

    // 1. Live LLM Generation via Vercel AI Gateway if gateway key is available
    const gatewayModel = resolveVercelAiGatewayModel(model, apiKey, gatewayUrl);

    if (gatewayModel) {
      try {
        if (stream) {
          const streamResult = streamText({
            model: gatewayModel,
            messages,
            tools: dynamicTools,
          });
          return streamResult.toTextStreamResponse();
        }

        const result = await generateText({
          model: gatewayModel,
          messages,
          tools: dynamicTools,
        });

        const toolName = (executedToolCall as any)?.name;
        return NextResponse.json({
          role: 'assistant',
          content: result.text || `Executed tool **${toolName || 'operation'}** via Vercel AI Gateway (${model}).`,
          toolCall: executedToolCall,
          result: executedToolResult,
        });
      } catch (gatewayError: any) {
        console.warn('Vercel AI Gateway request failed, falling back to simulated execution:', gatewayError.message);
        // Fall through to simulated execution if gateway throws (e.g. 404, invalid model, network error)
      }
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
      content: `Dispatched tool **${targetOp.id}** for query: _"${lastUserMessage}"_.\n\nSimulated through Vercel AI Gateway runner (${model}) with **Token Diet** output optimization.`,
      toolCall: {
        name: targetOp.id,
        args: mockArgs,
      },
      result: {
        text: execRes.result,
        savings: execRes.savings,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Sandbox execution error' },
      { status: 500 }
    );
  }
}
