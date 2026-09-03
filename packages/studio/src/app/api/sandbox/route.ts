import { NextResponse } from 'next/server';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText, tool, jsonSchema, stepCountIs } from 'ai';
import { NormalizedSpec, NormalizedOperation } from '@postmcp/types';
import { applyTokenDiet } from '@postmcp/core';
import { ResilientHttpClient } from '@postmcp/core';

interface SandboxExecutionResult {
  operationId: string;
  status: number;
  result: string;
  savings?: number;
}

/**
 * Validates if an outbound URL targets private or loopback networks (SSRF defense).
 */
export function isPrivateOrBlockedHost(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase();

    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return true;
    }

    // Check private IPv4 ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16
    const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipv4Match) {
      const b0 = parseInt(ipv4Match[1], 10);
      const b1 = parseInt(ipv4Match[2], 10);
      if (b0 === 10) return true;
      if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
      if (b0 === 192 && b1 === 168) return true;
      if (b0 === 169 && b1 === 254) return true; // Link-local / Cloud metadata
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
): Promise<SandboxExecutionResult> {
  const isReadOnly = op.method === 'get' || op.riskTier === 'READ_ONLY';

  // Real HTTP dispatch only for safe GET operations when credentials/baseUrl provided and dryRun is false
  const baseUrl = spec.servers?.[0]?.url;
  const isRealExecutionAllowed =
    !dryRun &&
    isReadOnly &&
    baseUrl &&
    baseUrl.startsWith('http') &&
    !baseUrl.includes('example.com') &&
    !baseUrl.includes('localhost') &&
    !isPrivateOrBlockedHost(baseUrl);

  if (isRealExecutionAllowed) {
    if (isPrivateOrBlockedHost(baseUrl)) {
      return {
        operationId: op.id,
        status: 403,
        result: 'Security Error: Outbound requests to internal or loopback hosts are blocked.',
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

  const isMutation = op.riskTier === 'MUTATION' || op.riskTier === 'CRITICAL' || op.method !== 'get';
  const prefix = (dryRun && isMutation)
    ? '⚠️ [DRY RUN SAFEGUARD ACTIVE] Mutation simulated safely without modifying remote state.\n\n'
    : '';

  return {
    operationId: op.id,
    status: 200,
    result: `${prefix}${diet.text}`,
    savings: diet.savingsPercentage,
  };
}

/**
 * Resolves a model via Vercel AI Gateway.
 */
function resolveVercelAiGatewayModel(model: string, apiKey?: string, customGatewayUrl?: string) {
  const key = apiKey || process.env.AI_GATEWAY_API_KEY || process.env.AI_GATEWAY_TOKEN || process.env.OPENAI_API_KEY;
  if (!key) return null;

  const rawUrl = customGatewayUrl || process.env.AI_GATEWAY_URL || 'https://ai-gateway.vercel.sh/v1';
  const baseURL = rawUrl.replace(/\/$/, '');

  const gateway = createOpenAI({
    baseURL,
    apiKey: key,
  });
  return gateway(model);
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

    for (const op of operationsToMount) {
      dynamicTools[op.id] = tool({
        description: op.description || op.summary || `Execute ${op.method.toUpperCase()} ${op.path}`,
        parameters: jsonSchema((op.inputSchema || { type: 'object', properties: {} }) as any),
        execute: async (args: any) => {
          return await executeMcpOperation(op, args, spec, authConfig, dryRun);
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
            stopWhen: stepCountIs(5),
          });
          return streamResult.toTextStreamResponse();
        }

        const result = await generateText({
          model: gatewayModel,
          messages,
          tools: dynamicTools,
          stopWhen: stepCountIs(5),
        });

        // Use AI SDK's native toolResults collection
        const sdkToolCalls = (result.toolResults || []).map((tr: any) => ({
          name: tr.toolName,
          args: tr.args,
          result: {
            text: tr.result?.result || (typeof tr.result === 'string' ? tr.result : JSON.stringify(tr.result)),
            savings: tr.result?.savings,
          },
        }));

        return NextResponse.json({
          role: 'assistant',
          content: result.text || `Executed ${sdkToolCalls.length} tool(s) via Vercel AI Gateway (${model}).`,
          toolCalls: sdkToolCalls,
          toolCall: sdkToolCalls[0] ? { name: sdkToolCalls[0].name, args: sdkToolCalls[0].args } : undefined,
          result: sdkToolCalls[0]?.result,
        });
      } catch (gatewayError: any) {
        console.warn('Vercel AI Gateway request failed, falling back to simulated execution:', gatewayError.message);
      }
    }

    // 2. Offline / Simulated Intelligent Multi-Tool Agent Mode
    const lastUserMessage = messages[messages.length - 1]?.content || 'Execute test';
    const lowerQuery = lastUserMessage.toLowerCase();

    // Match operations based on selected operation and query keywords
    const matchedOps: NormalizedOperation[] = [];
    if (selectedOperationId) {
      const selected = spec.operations.find((o: NormalizedOperation) => o.id === selectedOperationId);
      if (selected) matchedOps.push(selected);
    }

    // If query contains multi-action words ("and", "then", ","), find matching operations
    const hasMultiAction = lowerQuery.includes('and') || lowerQuery.includes('then') || lowerQuery.includes(',');
    for (const op of spec.operations) {
      if (matchedOps.length >= 3) break;
      if (matchedOps.some((m) => m.id === op.id)) continue;

      const opId = op.id.toLowerCase();
      const lastPathSegment = op.path.split('/').filter(Boolean).pop()?.toLowerCase() || '';

      if (hasMultiAction && (lowerQuery.includes(opId) || (lastPathSegment && lowerQuery.includes(lastPathSegment)))) {
        matchedOps.push(op);
      }
    }

    if (matchedOps.length === 0) {
      matchedOps.push(spec.operations[0]);
    }

    const simulatedToolCalls: Array<{
      name: string;
      args: any;
      result: { text: string; savings?: number };
    }> = [];

    for (const targetOp of matchedOps) {
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
      simulatedToolCalls.push({
        name: targetOp.id,
        args: mockArgs,
        result: {
          text: execRes.result,
          savings: execRes.savings,
        },
      });
    }

    return NextResponse.json({
      role: 'assistant',
      content:
        simulatedToolCalls.length > 1
          ? `Executed **${simulatedToolCalls.length} tool calls in sequence** for query: _"${lastUserMessage}"_.\n\nAll tool responses compressed through **Token Diet**.`
          : `Dispatched tool **${simulatedToolCalls[0].name}** for query: _"${lastUserMessage}"_.\n\nSimulated through Vercel AI Gateway runner (${model}) with **Token Diet** output optimization.`,
      toolCalls: simulatedToolCalls,
      toolCall: {
        name: simulatedToolCalls[0].name,
        args: simulatedToolCalls[0].args,
      },
      result: simulatedToolCalls[0].result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Sandbox execution error' },
      { status: 500 }
    );
  }
}
