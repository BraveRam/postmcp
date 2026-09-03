'use client';

import React, { useState, useRef, useEffect } from 'react';
import { NormalizedSpec, NormalizedOperation } from '@postmcp/types';
import { Switch } from './ui/Switch';
import { Card } from './ui/Card';
import { ModelSelectorDropdown } from './ModelSelectorDropdown';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputButton,
  PromptInputSubmit,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input';
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool';
import {
  Globe,
  Sparkles,
  Zap,
} from 'lucide-react';

interface LiveSandboxProps {
  spec: NormalizedSpec;
  selectedOperation: NormalizedOperation | null;
}

interface SandboxMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCall?: { name: string; args: any };
  result?: { text: string; savings?: number };
  toolCalls?: Array<{
    name: string;
    args: any;
    result?: { text: string; savings?: number };
  }>;
}

export function LiveSandbox({ spec, selectedOperation }: LiveSandboxProps) {
  const [model, setModel] = useState('zai/glm-5.3-flash');
  const [dryRun, setDryRun] = useState<boolean>(true);
  const [toolCardOpen, setToolCardOpen] = useState<Record<string, boolean>>({});

  const [inputPrompt, setInputPrompt] = useState(
    selectedOperation
      ? `Execute ${selectedOperation.id} with valid parameters`
      : 'List all resources and summarize status'
  );

  const [messages, setMessages] = useState<SandboxMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! The **${spec.title}** MCP server is connected via **Vercel AI Gateway** with **${spec.operations.length} context-optimized tools** and **Dry-Run Protection Active**. Ask me anything to test live tool dispatching and Token Diet output.`,
    },
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const conversationContentRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (conversationContentRef.current) {
      conversationContentRef.current.scrollTo({
        top: conversationContentRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  const toggleToolCard = (id: string) => {
    setToolCardOpen((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }));
  };

  const handleSubmit = async (message: PromptInputMessage) => {
    if (!message.text.trim() || isLoading) return;

    const userText = message.text.trim();
    const userMessage: SandboxMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: userText,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputPrompt('');
    setIsLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch('/api/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          model,
          dryRun,
          spec,
          selectedOperationId: selectedOperation?.id,
        }),
      });

      const data = await res.json();
      if (data.content || data.toolCall || (data.toolCalls && data.toolCalls.length > 0)) {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_${Date.now()}_res`,
            role: 'assistant',
            content: data.content,
            toolCall: data.toolCall,
            result: data.result,
            toolCalls: data.toolCalls,
          },
        ]);
      } else if (data.error) {
        throw new Error(data.error);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_${Date.now()}_err`,
            role: 'assistant',
            content: `Vercel AI Gateway execution error: ${err.message}`,
          },
        ]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-w-5xl space-y-3 sm:space-y-4 font-sans">
      {/* Top Configuration Bar */}
      <Card className="p-3 bg-zinc-950 border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs font-sans">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="font-semibold text-white flex items-center gap-1.5 font-sans shrink-0">
              <Globe className="h-4 w-4 text-zinc-300" />
              AI Gateway:
            </span>
            <ModelSelectorDropdown value={model} onChange={setModel} />
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-0 border-t sm:border-t-0 border-zinc-800">
            <span className="font-sans text-zinc-400 text-xs">Dry-Run Simulation:</span>
            <Switch checked={dryRun} onChange={setDryRun} />
          </div>
        </div>
      </Card>

      {/* AI Elements: Conversation Container */}
      <Card className="flex-1 flex flex-col overflow-hidden bg-black border-zinc-800 relative font-sans">
        <Conversation>
          <ConversationContent ref={conversationContentRef} className="p-3 sm:p-5 space-y-4">
            {messages.length === 0 ? (
              <ConversationEmptyState
                title="PostMCP Live Sandbox"
                description="Test live MCP tools synthesized from OpenAPI schemas via Vercel AI Gateway."
              />
            ) : (
              messages.map((m) => (
                <Message key={m.id} from={m.role}>
                  <MessageContent from={m.role}>
                    <MessageResponse>{m.content}</MessageResponse>

                    {/* AI Elements: Tool Components for all MCP Tool Calls */}
                    {(
                      m.toolCalls && m.toolCalls.length > 0
                        ? m.toolCalls
                        : m.toolCall
                        ? [{ name: m.toolCall.name, args: m.toolCall.args, result: m.result }]
                        : []
                    ).map((tc, idx) => {
                      const cardKey = `${m.id}_tool_${idx}`;
                      const isMulti = Boolean(m.toolCalls && m.toolCalls.length > 1);
                      return (
                        <div key={cardKey} className="mt-3">
                          <Tool status="complete">
                            <ToolHeader
                              name={tc.name}
                              status="complete"
                              badge={
                                isMulti
                                  ? `Step ${idx + 1} of ${m.toolCalls!.length}`
                                  : 'MCP Tool Call'
                              }
                              isOpen={toolCardOpen[cardKey] !== false}
                              onToggle={() => toggleToolCard(cardKey)}
                            />
                            <ToolContent isOpen={toolCardOpen[cardKey] !== false}>
                              <ToolInput input={tc.args} />
                              {tc.result && (
                                <ToolOutput
                                  output={tc.result.text}
                                  savings={tc.result.savings}
                                />
                              )}
                            </ToolContent>
                          </Tool>
                        </div>
                      );
                    })}
                  </MessageContent>
                </Message>
              ))
            )}

            {isLoading && (
              <Message from="assistant">
                <MessageContent from="assistant">
                  <div className="flex items-center gap-2 font-sans text-zinc-400">
                    <Sparkles className="h-3.5 w-3.5 animate-pulse text-white" />
                    <span>Executing via {model}...</span>
                  </div>
                </MessageContent>
              </Message>
            )}
          </ConversationContent>

          <ConversationScrollButton onClick={scrollToBottom} />
        </Conversation>

        {/* AI Elements: PromptInput Component */}
        <div className="p-3 border-t border-zinc-800 bg-zinc-950">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputBody>
              <PromptInputTextarea
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                placeholder={`Ask the AI agent to invoke OpenAPI endpoints through ${model}...`}
                disabled={isLoading}
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <PromptInputButton
                  onClick={() =>
                    setInputPrompt(
                      selectedOperation
                        ? `Execute ${selectedOperation.id} with parameters`
                        : 'List all resources and status'
                    )
                  }
                  tooltip="Fill active operation prompt template"
                >
                  <Zap className="h-3.5 w-3.5 mr-1" />
                  <span>Preset Prompt</span>
                </PromptInputButton>
              </PromptInputTools>
              <PromptInputSubmit
                status={isLoading ? 'streaming' : 'ready'}
                onStop={handleStop}
                disabled={!inputPrompt.trim() && !isLoading}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </Card>
    </div>
  );
}
