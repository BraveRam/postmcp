'use client';

import React, { useState, useRef, useEffect } from 'react';
import { NormalizedSpec, NormalizedOperation } from '@postmcp/types';
import { Switch } from './ui/Switch';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { ModelSelectorDropdown } from './ModelSelectorDropdown';
import {
  SandboxCredentialsModal,
  type HeaderRow,
} from './SandboxCredentialsModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/Dialog';
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
  Key,
  Trash2,
  AlertTriangle,
  X,
  Bot,
  Maximize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getScopedEnvKey } from '@/lib/env-scope';

export interface SandboxMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCall?: { name: string; args: any; toolCallId?: string };
  result?: { text: string; savings?: number };
  toolCalls?: Array<{
    toolCallId?: string;
    name: string;
    args: any;
    result?: { text: string; savings?: number };
    status?: 'running' | 'complete' | 'error';
  }>;
}

export interface LiveSandboxProps {
  spec: NormalizedSpec;
  selectedOperation: NormalizedOperation | null;
  isModal?: boolean;
  onClose?: () => void;
  onOpenModal?: () => void;
  messages?: SandboxMessage[];
  onMessagesChange?: React.Dispatch<React.SetStateAction<SandboxMessage[]>>;
}

export function LiveSandbox({
  spec,
  selectedOperation,
  isModal = false,
  onClose,
  onOpenModal,
  messages: controlledMessages,
  onMessagesChange: controlledSetMessages,
}: LiveSandboxProps) {
  const [model, setModel] = useState('zai/glm-5.3-flash');
  const [dryRun, setDryRun] = useState<boolean>(false);
  const [toolCardOpen, setToolCardOpen] = useState<Record<string, boolean>>({});

  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  const [bearerToken, setBearerToken] = useState<string>('');
  const [customHeaders, setCustomHeaders] = useState<HeaderRow[]>([
    { id: 'hdr_1', key: '', val: '' },
  ]);
  const [hasEnvCredentials, setHasEnvCredentials] = useState(false);

  // Sync credentials whenever the active spec changes
  useEffect(() => {
    // 1. Clean up legacy un-scoped storage keys if present
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('postmcp_sandbox_bearer_token');
      sessionStorage.removeItem('postmcp_sandbox_custom_headers');
    }

    const scopeKey = getScopedEnvKey(spec.title, spec.servers?.[0]?.url);
    let loadedFromSession = false;

    // Check scoped session storage first
    if (typeof window !== 'undefined') {
      try {
        const savedRaw = sessionStorage.getItem(`postmcp_sandbox_auth_${scopeKey}`);
        if (savedRaw) {
          const parsed = JSON.parse(savedRaw);
          if (parsed && (parsed.bearerToken !== undefined || parsed.customHeaders)) {
            setBearerToken(parsed.bearerToken || '');
            if (Array.isArray(parsed.customHeaders) && parsed.customHeaders.length > 0) {
              setCustomHeaders(parsed.customHeaders);
            } else {
              setCustomHeaders([{ id: 'hdr_1', key: '', val: '' }]);
            }
            loadedFromSession = true;
          }
        }
      } catch {}
    }

    // Check environment (.env)
    fetch(
      `/api/env?specTitle=${encodeURIComponent(spec.title || '')}&serverUrl=${encodeURIComponent(spec.servers?.[0]?.url || '')}&envVarName=${encodeURIComponent(scopeKey)}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (data && data.hasValue) {
          setHasEnvCredentials(true);
          // If session didn't explicitly override it, load the active credentials from .env
          if (!loadedFromSession) {
            setBearerToken(data.value || '');
            if (Array.isArray(data.customHeaders) && data.customHeaders.length > 0) {
              setCustomHeaders(
                data.customHeaders.map((h: any, idx: number) => ({
                  id: `hdr_${idx + 1}`,
                  key: h.key,
                  val: h.val,
                }))
              );
            } else {
              setCustomHeaders([{ id: 'hdr_1', key: '', val: '' }]);
            }
          }
        } else {
          setHasEnvCredentials(false);
          if (!loadedFromSession) {
            setBearerToken('');
            setCustomHeaders([{ id: 'hdr_1', key: '', val: '' }]);
          }
        }
      })
      .catch(() => {
        if (!loadedFromSession) {
          setHasEnvCredentials(false);
          setBearerToken('');
          setCustomHeaders([{ id: 'hdr_1', key: '', val: '' }]);
        }
      });
  }, [spec.title, spec.servers]);

  const handleSaveCredentials = (token: string, headers: HeaderRow[]) => {
    setBearerToken(token);
    setCustomHeaders(headers);
    const scopeKey = getScopedEnvKey(spec.title, spec.servers?.[0]?.url);
    if (typeof window !== 'undefined') {
      if (token.trim() || headers.some((h) => h.key.trim() && h.val.trim())) {
        sessionStorage.setItem(
          `postmcp_sandbox_auth_${scopeKey}`,
          JSON.stringify({ bearerToken: token, customHeaders: headers })
        );
      } else {
        sessionStorage.removeItem(`postmcp_sandbox_auth_${scopeKey}`);
      }
    }
  };

  const hasCredentials = Boolean(
    bearerToken.trim() ||
      customHeaders.some((h) => h.key.trim() && h.val.trim()) ||
      hasEnvCredentials
  );

  const [inputPrompt, setInputPrompt] = useState(
    selectedOperation
      ? `Execute ${selectedOperation.id} with valid parameters`
      : 'List all resources and summarize status'
  );

  const [internalMessages, setInternalMessages] = useState<SandboxMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! The **${spec.title}** MCP server is connected via **Vercel AI Gateway** with **${spec.operations.length} context-optimized tools**. Ask me anything to test live tool dispatching and Token Diet output.`,
    },
  ]);

  const messages = controlledMessages !== undefined ? controlledMessages : internalMessages;
  const setMessages = controlledSetMessages !== undefined ? controlledSetMessages : setInternalMessages;

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

  const toggleToolCard = (key: string) => {
    setToolCardOpen((prev) => ({
      ...prev,
      [key]: prev[key] === false ? true : false,
    }));
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };

  const handleConfirmClearChat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setMessages([]);
    setInputPrompt('');
    setIsClearModalOpen(false);
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
    const assistantMsgId = `msg_${Date.now()}_res`;

    try {
      const customFieldsRecord: Record<string, string> = {};
      for (const h of customHeaders) {
        if (h.key.trim() && h.val.trim()) {
          customFieldsRecord[h.key.trim()] = h.val.trim();
        }
      }
      const authConfig = {
        bearerToken: bearerToken.trim() || undefined,
        headers: Object.keys(customFieldsRecord).length > 0 ? customFieldsRecord : undefined,
        customFields: customHeaders
          .filter((h) => h.key.trim() && h.val.trim())
          .map((h) => ({ key: h.key.trim(), value: h.val.trim() })),
      };

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
          authConfig: authConfig.bearerToken || authConfig.customFields ? authConfig : undefined,
          stream: true,
        }),
      });

      if (res.body && res.headers.get('content-type')?.includes('text/event-stream')) {
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            role: 'assistant',
            content: '',
            toolCalls: [],
          },
        ]);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') continue;

            try {
              const event = JSON.parse(dataStr);
              if (event.type === 'tool-call') {
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== assistantMsgId) return msg;
                    const tools = [...(msg.toolCalls || [])];
                    const existingIdx = tools.findIndex(
                      (t) =>
                        (event.toolCallId && (t as any).toolCallId === event.toolCallId) ||
                        (t.name === event.name && (!t.result || t.status === 'running'))
                    );
                    if (existingIdx >= 0) {
                      tools[existingIdx] = {
                        ...tools[existingIdx],
                        toolCallId: event.toolCallId || (tools[existingIdx] as any).toolCallId,
                        args: event.args ?? tools[existingIdx].args,
                        status: tools[existingIdx].result ? 'complete' : 'running',
                      };
                    } else {
                      tools.push({
                        toolCallId: event.toolCallId,
                        name: event.name,
                        args: event.args,
                        status: 'running',
                      });
                    }
                    return {
                      ...msg,
                      toolCall: tools[0] ? { name: tools[0].name, args: tools[0].args, toolCallId: tools[0].toolCallId } : undefined,
                      toolCalls: tools,
                    };
                  })
                );
              } else if (event.type === 'tool-result') {
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== assistantMsgId) return msg;
                    const tools = [...(msg.toolCalls || [])];
                    const existingIdx = tools.findIndex(
                      (t) =>
                        (event.toolCallId && (t as any).toolCallId === event.toolCallId) ||
                        (t.name === event.name)
                    );
                    const formattedResult =
                      typeof event.result === 'string'
                        ? { text: event.result }
                        : event.result || { text: 'Operation completed.' };

                    if (existingIdx >= 0) {
                      tools[existingIdx] = {
                        ...tools[existingIdx],
                        toolCallId: event.toolCallId || (tools[existingIdx] as any).toolCallId,
                        args: event.args ?? tools[existingIdx].args,
                        result: formattedResult,
                        status: 'complete',
                      };
                    } else {
                      tools.push({
                        toolCallId: event.toolCallId,
                        name: event.name,
                        args: event.args,
                        result: formattedResult,
                        status: 'complete',
                      });
                    }
                    return {
                      ...msg,
                      toolCall: tools[0] ? { name: tools[0].name, args: tools[0].args, toolCallId: tools[0].toolCallId } : undefined,
                      result: tools[0]?.result,
                      toolCalls: tools,
                    };
                  })
                );
              } else if (event.type === 'text-delta') {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, content: msg.content + event.text }
                      : msg
                  )
                );
              } else if (event.type === 'done') {
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== assistantMsgId || !msg.toolCalls) return msg;
                    return {
                      ...msg,
                      toolCalls: msg.toolCalls.map((tc) => ({
                        ...tc,
                        status: tc.status === 'error' ? ('error' as const) : ('complete' as const),
                        result: tc.result || { text: 'Operation completed.' },
                      })),
                    };
                  })
                );
              } else if (event.type === 'error') {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? {
                          ...msg,
                          content: msg.content
                            ? `${msg.content}\n\nError: ${event.error}`
                            : `Error: ${event.error}`,
                        }
                      : msg
                  )
                );
              }
            } catch {
              // Ignore malformed SSE chunk
            }
          }
        }

        // Finalize all tool states once SSE reading loop terminates
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id !== assistantMsgId || !msg.toolCalls || msg.toolCalls.length === 0) return msg;
            const finalized = msg.toolCalls.map((tc) => ({
              ...tc,
              status: tc.status === 'error' ? ('error' as const) : ('complete' as const),
              result: tc.result || { text: 'Operation completed.' },
            }));
            return {
              ...msg,
              toolCalls: finalized,
              toolCall: finalized[0] ? { name: finalized[0].name, args: finalized[0].args, toolCallId: finalized[0].toolCallId } : undefined,
              result: finalized[0]?.result,
            };
          })
        );
      } else {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to execute prompt in live sandbox');
        }

        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            role: 'assistant',
            content: data.response || 'Operation completed.',
            toolCall: data.toolCall,
            result: data.result,
            toolCalls: data.toolCalls || (data.toolCall ? [{ ...data.toolCall, result: data.result, status: 'complete' }] : undefined),
          },
        ]);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages((prev) => {
          const existing = prev.find((m) => m.id === assistantMsgId);
          if (existing) {
            return prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content: m.content
                      ? `${m.content}\n\nExecution error: ${err.message}`
                      : `Execution error: ${err.message}`,
                  }
                : m
            );
          }
          return [
            ...prev,
            {
              id: `msg_${Date.now()}_err`,
              role: 'assistant',
              content: `Vercel AI Gateway execution error: ${err.message}`,
            },
          ];
        });
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== assistantMsgId || !msg.toolCalls || msg.toolCalls.length === 0) return msg;
          const finalized = msg.toolCalls.map((tc) => ({
            ...tc,
            status: tc.status === 'error' ? ('error' as const) : ('complete' as const),
            result: tc.result || { text: 'Operation completed.' },
          }));
          return {
            ...msg,
            toolCalls: finalized,
            toolCall: finalized[0] ? { name: finalized[0].name, args: finalized[0].args, toolCallId: finalized[0].toolCallId } : undefined,
            result: finalized[0]?.result,
          };
        })
      );
    }
  };

  return (
    <div
      className={cn(
        'font-sans flex flex-col',
        isModal
          ? 'h-full w-full overflow-hidden bg-background'
          : 'h-[calc(100vh-140px)] max-w-5xl space-y-3 sm:space-y-4'
      )}
    >
      {/* Configuration Header Bar */}
      {isModal ? (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/40 shrink-0 gap-3">
          {/* Left: Branding & Spec Info */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-7 w-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold text-foreground font-sans tracking-tight shrink-0">
                AI Sandbox
              </span>
              <span className="text-[10px] font-sans text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5 truncate max-w-[140px] sm:max-w-[200px]">
                {spec.title}
              </span>
              {selectedOperation && (
                <span className="text-[10px] font-semibold text-foreground bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5 truncate hidden md:inline">
                  {selectedOperation.method.toUpperCase()} {selectedOperation.path}
                </span>
              )}
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap justify-end">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-foreground flex items-center gap-1 text-[11px] font-sans hidden sm:flex shrink-0">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                Gateway:
              </span>
              <ModelSelectorDropdown value={model} onChange={setModel} />
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCredentialsModalOpen(true)}
              className="h-7 text-xs flex items-center gap-1.5 font-sans relative hover:bg-muted/80"
              title="Configure target API authentication credentials and custom headers"
            >
              <Key className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Credentials</span>
              {hasCredentials && (
                <span className="ml-0.5 inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/30">
                  Active
                </span>
              )}
            </Button>

            <div className="flex items-center gap-1.5 text-xs font-sans">
              <span className="text-muted-foreground text-[11px] hidden lg:inline">Dry-Run:</span>
              <Switch checked={dryRun} onChange={setDryRun} />
            </div>

            <div className="h-4 w-[1px] bg-border mx-0.5 hidden sm:block" />

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsClearModalOpen(true)}
              disabled={messages.length === 0 && !isLoading}
              className="h-7 text-xs flex items-center gap-1.5 font-sans text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 transition-colors"
              title="Clear all chat history"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear Chat</span>
            </Button>

            {onClose && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer rounded"
                title="Close AI Sandbox Modal"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ) : (
        <Card className="p-3 bg-card border-border shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs font-sans">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <span className="font-semibold text-foreground flex items-center gap-1.5 font-sans shrink-0">
                <Globe className="h-4 w-4 text-muted-foreground" />
                AI Gateway:
              </span>
              <ModelSelectorDropdown value={model} onChange={setModel} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCredentialsModalOpen(true)}
                className="h-7 text-xs flex items-center gap-1.5 font-sans relative hover:bg-muted/80"
                title="Configure target API authentication credentials and custom headers"
              >
                <Key className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Credentials</span>
                {hasCredentials && (
                  <span className="ml-1 inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/30">
                    Active
                  </span>
                )}
              </Button>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-1 sm:pt-0 border-t sm:border-t-0 border-border flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-sans text-muted-foreground text-xs">Dry-Run Simulation:</span>
                <Switch checked={dryRun} onChange={setDryRun} />
              </div>

              <div className="h-4 w-[1px] bg-border mx-1 hidden sm:block" />

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsClearModalOpen(true)}
                disabled={messages.length === 0 && !isLoading}
                className="h-7 text-xs flex items-center gap-1.5 font-sans text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 transition-colors"
                title="Clear all chat history"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear Chat</span>
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* AI Elements: Conversation Container */}
      <Card
        className={cn(
          'flex-1 flex flex-col overflow-hidden bg-card font-sans relative',
          isModal ? 'border-none rounded-none' : 'border-border'
        )}
      >
        <Conversation>
          <ConversationContent ref={conversationContentRef} className="p-3 sm:p-5 space-y-4">
            {messages.length === 0 ? (
              <ConversationEmptyState
                title="PostMCP Live Sandbox"
                description="Test live MCP tools synthesized from OpenAPI schemas via Vercel AI Gateway."
              />
            ) : (
              messages
                .filter(
                  (m) =>
                    m.role === 'user' ||
                    m.content.trim().length > 0 ||
                    (m.toolCalls && m.toolCalls.length > 0) ||
                    m.toolCall
                )
                .map((m) => {
                  const activeTools =
                    m.toolCalls && m.toolCalls.length > 0
                      ? m.toolCalls
                      : m.toolCall
                      ? [{ name: m.toolCall.name, args: m.toolCall.args, result: m.result, toolCallId: m.toolCall.toolCallId }]
                      : [];
                  const hasTools = activeTools.length > 0;

                  return (
                    <Message key={m.id} from={m.role}>
                      <MessageContent from={m.role}>
                        {/* AI Elements: Tool Components rendered BEFORE the actual message */}
                        {hasTools && (
                          <div className="space-y-3 mb-3">
                            {activeTools.map((tc, idx) => {
                              const cardKey = `${m.id}_tool_${(tc as any).toolCallId || tc.name}_${idx}`;
                              const isMulti = activeTools.length > 1;
                              const isToolRunning = isLoading && tc.status === 'running' && !tc.result;
                              const effectiveStatus = tc.status === 'error' ? 'error' : isToolRunning ? 'running' : 'complete';
                              const displayOutput =
                                typeof tc.result === 'string'
                                  ? tc.result
                                  : (tc.result?.text ?? (tc.result as any)?.result ?? (tc.result ? JSON.stringify(tc.result, null, 2) : undefined));

                              return (
                                <Tool key={cardKey} status={effectiveStatus}>
                                  <ToolHeader
                                    name={tc.name}
                                    status={effectiveStatus}
                                    badge={
                                      isMulti
                                        ? `Step ${idx + 1} of ${activeTools.length}`
                                        : 'MCP Tool Call'
                                    }
                                    savings={tc.result?.savings}
                                    isOpen={toolCardOpen[cardKey] !== false}
                                    onToggle={() => toggleToolCard(cardKey)}
                                  />
                                  <ToolContent isOpen={toolCardOpen[cardKey] !== false}>
                                    <ToolInput input={tc.args} />
                                    <ToolOutput
                                      output={displayOutput}
                                      savings={tc.result?.savings}
                                      status={effectiveStatus}
                                    />
                                  </ToolContent>
                                </Tool>
                              );
                            })}
                          </div>
                        )}

                        {/* Actual message content rendered AFTER the tool calls */}
                        {m.content && (
                          <div className={cn(hasTools ? 'pt-1.5 border-t border-border/40' : '')}>
                            {m.role === 'user' ? (
                              <div className="whitespace-pre-wrap font-sans text-xs leading-relaxed">
                                {m.content}
                              </div>
                            ) : (
                              <MessageResponse>{m.content}</MessageResponse>
                            )}
                          </div>
                        )}
                      </MessageContent>
                    </Message>
                  );
                })
            )}

            {isLoading &&
              (() => {
                const lastMsg = messages[messages.length - 1];
                const hasStarted =
                  lastMsg &&
                  lastMsg.role === 'assistant' &&
                  (lastMsg.content.trim().length > 0 ||
                    (lastMsg.toolCalls && lastMsg.toolCalls.length > 0));
                if (hasStarted) return null;
                return (
                  <Message from="assistant">
                    <MessageContent from="assistant">
                      <div className="flex items-center gap-2 font-sans text-muted-foreground">
                        <Sparkles className="h-3.5 w-3.5 animate-pulse text-foreground" />
                        <span>Executing via {model}...</span>
                      </div>
                    </MessageContent>
                  </Message>
                );
              })()}
          </ConversationContent>

          <ConversationScrollButton onClick={scrollToBottom} />
        </Conversation>

        {/* AI Elements: PromptInput Component */}
        <div className="p-3 border-t border-border bg-background shrink-0">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputBody>
              <PromptInputTextarea
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                placeholder={`Ask the AI agent to invoke OpenAPI endpoints through ${model}...`}
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <PromptInputButton
                  onClick={() =>
                    setInputPrompt(
                      selectedOperation
                        ? `Execute ${selectedOperation.id} with valid parameters`
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

      {/* Target Credentials Modal */}
      <SandboxCredentialsModal
        isOpen={isCredentialsModalOpen}
        onClose={() => setIsCredentialsModalOpen(false)}
        bearerToken={bearerToken}
        customHeaders={customHeaders}
        onSave={handleSaveCredentials}
        specTitle={spec.title}
        serverUrl={spec.servers?.[0]?.url}
      />

      {/* Clear Chat Confirmation Warning Modal */}
      <Dialog open={isClearModalOpen} onOpenChange={setIsClearModalOpen}>
        <DialogContent className="max-w-md p-5 sm:p-6 font-sans">
          <DialogHeader className="gap-2">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <DialogTitle className="text-base font-bold font-sans">Clear Chat History?</DialogTitle>
            </div>
            <DialogDescription className="text-xs font-sans text-muted-foreground leading-relaxed">
              Are you sure you want to clear all messages, tool calls, and execution history? This action cannot be undone and will reset the current sandbox session.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border mt-3 font-sans">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsClearModalOpen(false)}
              className="font-sans text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmClearChat}
              className="font-sans text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear Chat
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
