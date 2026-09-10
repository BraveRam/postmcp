import { NextResponse } from 'next/server';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText, tool, jsonSchema, stepCountIs } from 'ai';
import { NormalizedSpec, NormalizedOperation } from '@postmcp/types';
import { applyTokenDiet } from '@postmcp/core';
import { ResilientHttpClient } from '@postmcp/core';
import { getScopedEnvKey } from '@/lib/env-scope';

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

export function resolveTargetAuthConfig(
  incomingAuth?: any,
  spec?: NormalizedSpec
): any {
  const headers: Record<string, string> = { ...(incomingAuth?.headers || {}) };

  // If customFields are provided (array of { key, value } or plain object), merge into headers
  if (Array.isArray(incomingAuth?.customFields)) {
    for (const field of incomingAuth.customFields) {
      if (field && field.key && (field.value !== undefined || field.val !== undefined)) {
        headers[field.key.trim()] = String(field.value ?? field.val).trim();
      }
    }
  } else if (incomingAuth?.customFields && typeof incomingAuth.customFields === 'object') {
    for (const [k, v] of Object.entries(incomingAuth.customFields)) {
      if (k.trim() && v !== undefined && v !== null) {
        headers[k.trim()] = String(v).trim();
      }
    }
  }

  // Resolve Bearer token
  let bearerToken = incomingAuth?.bearerToken?.trim();

  // If user entered Authorization in custom headers
  if (!bearerToken && headers['Authorization']) {
    const authHeader = headers['Authorization'];
    if (authHeader.toLowerCase().startsWith('bearer ')) {
      bearerToken = authHeader.slice(7).trim();
    }
  }

  // Auto-resolve env fallbacks if not provided in request
  const scopedKey = getScopedEnvKey(spec?.title, spec?.servers?.[0]?.url);
  if (!bearerToken) {
    bearerToken =
      process.env[scopedKey] ||
      (scopedKey !== 'BEARER_TOKEN' ? process.env.BEARER_TOKEN : undefined) ||
      process.env.API_KEY;
  }

  // Auto-resolve any matching scoped headers from environment
  const scopedPrefix = scopedKey.replace(/_(API_KEY|TOKEN|SECRET_KEY|KEY|AUTH_TOKEN)$/i, '');
  for (const [envKey, envVal] of Object.entries(process.env)) {
    if (envVal && envKey.startsWith(`${scopedPrefix}_HEADER_`)) {
      const headerName = envKey.slice(`${scopedPrefix}_HEADER_`.length).replace(/_/g, '-');
      if (!headers[headerName]) {
        headers[headerName] = envVal;
      }
    }
  }

  if (bearerToken && !headers['Authorization']) {
    headers['Authorization'] = bearerToken.startsWith('Bearer ') ? bearerToken : `Bearer ${bearerToken}`;
  }

  return {
    ...incomingAuth,
    bearerToken,
    headers,
  };
}

async function executeMcpOperation(
  op: NormalizedOperation,
  args: any,
  spec: NormalizedSpec,
  authConfig?: any,
  dryRun: boolean = true
): Promise<SandboxExecutionResult> {
  const isCritical = op.riskTier === 'CRITICAL';
  const baseUrl = spec.servers?.[0]?.url;

  // Real HTTP dispatch when dryRun is false, not a critical destructive action, and targeting a public URL
  const isRealExecutionAllowed =
    !dryRun &&
    !isCritical &&
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
        timeout: 15000,
      });

      let targetUrl = op.path;
      const queryParams: Record<string, any> = {};
      const bodyData: Record<string, any> = {};

      if (args) {
        for (const [k, v] of Object.entries(args)) {
          if (targetUrl.includes(`{${k}}`)) {
            targetUrl = targetUrl.replace(`{${k}}`, encodeURIComponent(String(v)));
          } else if (op.parameters?.some((p) => p.name === k && p.in === 'query')) {
            queryParams[k] = v;
          } else if (op.parameters?.some((p) => p.name === k && (p.in === 'header' || p.in === 'cookie'))) {
            // Header or cookie parameter
          } else {
            bodyData[k] = v;
          }
        }
      }

      const isBodyMethod = ['post', 'put', 'patch', 'delete'].includes(op.method.toLowerCase());
      const res = await client.request({
        url: targetUrl,
        method: op.method.toUpperCase() as any,
        data: isBodyMethod
          ? args.requestBody !== undefined
            ? args.requestBody
            : Object.keys(bodyData).length > 0
            ? bodyData
            : undefined
          : undefined,
        params: Object.keys(queryParams).length > 0 ? queryParams : (!isBodyMethod ? args : undefined),
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
        result: `Failed to execute live endpoint: ${err.message}`,
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
  let prefix = '';
  if (dryRun && isMutation) {
    prefix = '[DRY RUN SAFEGUARD ACTIVE] Mutation simulated safely without modifying remote state.\n\n';
  } else if (!dryRun && isCritical) {
    prefix = '[SAFETY SAFEGUARD] Destructive CRITICAL operations are simulated in the web sandbox.\n\n';
  }

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

    const resolvedAuth = resolveTargetAuthConfig(authConfig, spec);

    // Dynamically mount tools for active operations
    const dynamicTools: Record<string, any> = {};
    const operationsToMount: NormalizedOperation[] = spec.operations.slice(0, 20);

    const executedToolCalls: Array<{
      name: string;
      args: any;
      result: { text: string; savings?: number };
    }> = [];

    let onToolExecutionEvent: ((event: any) => void) | null = null;

    for (const op of operationsToMount) {
      const opSchema = (op.inputSchema || { type: 'object', properties: {} }) as any;
      dynamicTools[op.id] = tool({
        description: op.description || op.summary || `Execute ${op.method.toUpperCase()} ${op.path}`,
        inputSchema: jsonSchema(opSchema),
        parameters: jsonSchema(opSchema),
        execute: async (args: any) => {
          const execRes = await executeMcpOperation(op, args, spec, resolvedAuth, dryRun);
          const toolData = {
            name: op.id,
            args,
            result: {
              text: execRes.result,
              savings: execRes.savings,
            },
          };
          executedToolCalls.push(toolData);
          return execRes;
        },
      } as any);
    }

    // 1. Live LLM Generation via Vercel AI Gateway if gateway key is available
    const gatewayModel = resolveVercelAiGatewayModel(model, apiKey, gatewayUrl);

    if (gatewayModel) {
      try {
        if (stream) {
          const activeToolCalls = new Map<string, { name: string; args: any }>();
          const emittedToolResults = new Set<string>();

          const streamResult = streamText({
            model: gatewayModel,
            messages,
            tools: dynamicTools,
            stopWhen: stepCountIs(5),
            onToolExecutionStart: ({ toolCall }) => {
              activeToolCalls.set(toolCall.toolCallId, {
                name: toolCall.toolName,
                args: toolCall.input,
              });
              if (onToolExecutionEvent) {
                onToolExecutionEvent({
                  type: 'tool-call',
                  toolCallId: toolCall.toolCallId,
                  name: toolCall.toolName,
                  args: toolCall.input,
                });
              }
            },
            onToolExecutionEnd: ({ toolCall, toolOutput }) => {
              emittedToolResults.add(toolCall.toolCallId);
              const out = (toolOutput as any)?.output ?? toolOutput;
              const text =
                out?.result ??
                (typeof out === 'string'
                  ? out
                  : typeof out?.text === 'string'
                  ? out.text
                  : JSON.stringify(out ?? {}));
              if (onToolExecutionEvent) {
                onToolExecutionEvent({
                  type: 'tool-result',
                  toolCallId: toolCall.toolCallId,
                  name: toolCall.toolName,
                  args: toolCall.input ?? {},
                  result: {
                    text,
                    savings: out?.savings,
                  },
                });
              }
            },
          });

          const encoder = new TextEncoder();
          const readableStream = new ReadableStream({
            async start(controller) {
              onToolExecutionEvent = (event) => {
                try {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
                } catch {}
              };

              try {
                for await (const chunk of streamResult.fullStream) {
                  if (chunk.type === 'tool-call') {
                    if (!activeToolCalls.has(chunk.toolCallId)) {
                      activeToolCalls.set(chunk.toolCallId, {
                        name: chunk.toolName,
                        args: chunk.input,
                      });
                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({
                            type: 'tool-call',
                            toolCallId: chunk.toolCallId,
                            name: chunk.toolName,
                            args: chunk.input,
                          })}\n\n`
                        )
                      );
                    }
                  } else if (chunk.type === 'tool-result') {
                    if (!emittedToolResults.has(chunk.toolCallId)) {
                      emittedToolResults.add(chunk.toolCallId);
                      const out = (chunk.output ?? (chunk as any).result) as any;
                      const text =
                        out?.result ??
                        (typeof out === 'string'
                          ? out
                          : typeof out?.text === 'string'
                          ? out.text
                          : JSON.stringify(out ?? {}));
                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({
                            type: 'tool-result',
                            toolCallId: chunk.toolCallId,
                            name: chunk.toolName,
                            args: chunk.input ?? (chunk as any).args ?? {},
                            result: {
                              text,
                              savings: out?.savings,
                            },
                          })}\n\n`
                        )
                      );
                    }
                  } else if (chunk.type === 'text-delta') {
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          type: 'text-delta',
                          text: chunk.text,
                        })}\n\n`
                      )
                    );
                  }
                }

                // Ensure all started tool calls have their results sent before ending
                for (const [id, tc] of activeToolCalls.entries()) {
                  if (!emittedToolResults.has(id)) {
                    emittedToolResults.add(id);
                    const matched = executedToolCalls.find((e) => e.name === tc.name);
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          type: 'tool-result',
                          toolCallId: id,
                          name: tc.name,
                          args: tc.args,
                          result: matched?.result || { text: 'Operation completed.' },
                        })}\n\n`
                      )
                    );
                  }
                }

                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
                controller.close();
              } catch (streamErr: any) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'error',
                      error: streamErr.message || 'Streaming failed',
                    })}\n\n`
                  )
                );
                controller.close();
              } finally {
                onToolExecutionEvent = null;
              }
            },
          });

          return new Response(readableStream, {
            headers: {
              'Content-Type': 'text/event-stream; charset=utf-8',
              'Cache-Control': 'no-cache, no-transform',
              'Connection': 'keep-alive',
            },
          });
        }

        const result = await generateText({
          model: gatewayModel,
          messages,
          tools: dynamicTools,
          stopWhen: stepCountIs(5),
        });

        // Use executedToolCalls directly or AI SDK's toolResults collection
        const sdkToolCalls =
          executedToolCalls.length > 0
            ? executedToolCalls
            : (result.toolResults || []).map((tr: any) => {
                const out = tr.output ?? tr.result;
                const text =
                  out?.result ??
                  (typeof out === 'string'
                    ? out
                    : typeof out?.text === 'string'
                    ? out.text
                    : JSON.stringify(out ?? {}));
                return {
                  name: tr.toolName,
                  args: tr.input ?? tr.args ?? {},
                  result: {
                    text,
                    savings: out?.savings,
                  },
                };
              });

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
            : p.name.includes('url')
            ? 'https://pullora.chat'
            : 'sample_val';
        }
      }
      if (targetOp.inputSchema?.properties) {
        for (const [propName] of Object.entries(targetOp.inputSchema.properties)) {
          if (!mockArgs[propName]) {
            mockArgs[propName] = propName.includes('url')
              ? 'https://pullora.chat'
              : propName.includes('id')
              ? 'obj_882910'
              : 'sample_val';
          }
        }
      }

      const execRes = await executeMcpOperation(targetOp, mockArgs, spec, resolvedAuth, dryRun);
      simulatedToolCalls.push({
        name: targetOp.id,
        args: mockArgs,
        result: {
          text: execRes.result,
          savings: execRes.savings,
        },
      });
    }

    const simulatedContent =
      simulatedToolCalls.length > 1
        ? `Executed **${simulatedToolCalls.length} tool calls in sequence** for query: _"${lastUserMessage}"_.\n\nAll tool responses compressed through **Token Diet**.`
        : `Dispatched tool **${simulatedToolCalls[0].name}** for query: _"${lastUserMessage}"_.\n\nSimulated through Vercel AI Gateway runner (${model}) with **Token Diet** output optimization.`;

    if (stream) {
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for (let i = 0; i < simulatedToolCalls.length; i++) {
              const tc = simulatedToolCalls[i];
              const simId = `sim_${tc.name}_${i}_${Date.now()}`;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'tool-call',
                    toolCallId: simId,
                    name: tc.name,
                    args: tc.args,
                  })}\n\n`
                )
              );
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'tool-result',
                    toolCallId: simId,
                    name: tc.name,
                    args: tc.args,
                    result: tc.result,
                  })}\n\n`
                )
              );
            }

            const words = simulatedContent.split(' ');
            for (let i = 0; i < words.length; i++) {
              const chunkText = (i === 0 ? '' : ' ') + words[i];
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'text-delta',
                    text: chunkText,
                  })}\n\n`
                )
              );
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
            controller.close();
          } catch (simErr: any) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'error',
                  error: simErr.message || 'Simulation streaming error',
                })}\n\n`
              )
            );
            controller.close();
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
        },
      });
    }

    return NextResponse.json({
      role: 'assistant',
      content: simulatedContent,
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
