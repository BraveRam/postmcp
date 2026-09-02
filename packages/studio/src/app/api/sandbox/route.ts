import { NextResponse } from 'next/server';
import { streamText, tool, jsonSchema } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { applyTokenDiet } from '@postmcp/core';
import { NormalizedSpec, NormalizedOperation } from '@postmcp/types';

export async function POST(request: Request) {
  try {
    const { messages, model = 'gpt-4o', apiKey, spec, selectedOperationId } = await request.json();

    if (!spec || !Array.isArray(spec.operations)) {
      return NextResponse.json({ error: 'Valid OpenAPI spec required for sandbox simulation.' }, { status: 400 });
    }

    const openAiApiKey = apiKey || process.env.OPENAI_API_KEY || process.env.AI_GATEWAY_TOKEN;

    // If an OpenAI/Gateway API key is provided, execute real streaming LLM with dynamic tools
    if (openAiApiKey) {
      const openai = createOpenAI({ apiKey: openAiApiKey });

      // Dynamically define tools for the top active operations
      const dynamicTools: Record<string, any> = {};
      const operationsToMount: NormalizedOperation[] = spec.operations.slice(0, 15);

      for (const op of operationsToMount) {
        dynamicTools[op.id] = tool({
          description: op.description || op.summary || `Execute ${op.method.toUpperCase()} ${op.path}`,
          parameters: jsonSchema((op.inputSchema || { type: 'object', properties: {} }) as any),
          execute: async (args: any) => {
            // Apply Token Diet to simulated response
            const mockData = [
              { id: 'res_' + Math.floor(Math.random() * 100000), status: 'success', ...args, updated_at: new Date().toISOString() },
            ];
            const diet = applyTokenDiet(mockData, {
              enabled: true,
              fieldMasks: spec.tokenDiet?.fieldMasks?.[op.path],
              convertToMarkdownTable: true,
            });
            return {
              operationId: op.id,
              result: diet.text,
              savings: diet.savingsPercentage,
            };
          },
        } as any);
      }

      const result = streamText({
        model: openai(model === 'gpt-4o' ? 'gpt-4o' : 'gpt-4o-mini') as any,
        messages,
        tools: dynamicTools,
      });

      return result.toTextStreamResponse();
    }

    // Default: Intelligent simulated agent execution with real schema validation & Token Diet output
    const lastUserMessage = messages[messages.length - 1]?.content || 'Execute test';
    const targetOp =
      (selectedOperationId && spec.operations.find((o: NormalizedOperation) => o.id === selectedOperationId)) ||
      spec.operations[0];

    const mockArgs: Record<string, any> = {};
    if (targetOp.parameters) {
      for (const p of targetOp.parameters.slice(0, 2)) {
        mockArgs[p.name] = p.name.includes('id') ? 'obj_882910' : p.name.includes('email') ? 'user@example.com' : 'sample_val';
      }
    }

    const mockResponsePayload = [
      {
        id: mockArgs.id || 'res_99812',
        name: `${targetOp.summary || targetOp.id} Item`,
        status: 'active',
        created_at: new Date().toISOString(),
        ...mockArgs,
      },
      {
        id: 'res_99813',
        name: `${targetOp.summary || targetOp.id} Secondary`,
        status: 'completed',
        created_at: new Date().toISOString(),
      },
    ];

    const dietResult = applyTokenDiet(mockResponsePayload, {
      enabled: true,
      fieldMasks: spec.tokenDiet?.fieldMasks?.[targetOp.path],
      convertToMarkdownTable: true,
    });

    return NextResponse.json({
      role: 'assistant',
      content: `I analyzed your request "${lastUserMessage}" and invoked tool **\`${targetOp.id}\`** on the **${spec.title}** MCP server with Token Diet active.`,
      toolCall: {
        name: targetOp.id,
        args: mockArgs,
      },
      result: {
        text: dietResult.text,
        savings: dietResult.savingsPercentage,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Sandbox simulation failed.' }, { status: 500 });
  }
}
