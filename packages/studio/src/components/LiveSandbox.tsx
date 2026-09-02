'use client';

import React, { useState, useRef, useEffect } from 'react';
import { NormalizedSpec, NormalizedOperation } from '@postmcp/types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { Switch } from './ui/Switch';
import { Card } from './ui/Card';
import {
  Bot,
  User,
  Send,
  Terminal,
  KeyRound,
  Loader2,
  Square,
  Sparkles,
  TrendingDown,
  Globe,
  Settings2,
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
}

export function LiveSandbox({ spec, selectedOperation }: LiveSandboxProps) {
  const [model, setModel] = useState('openai/gpt-4o');
  const [gatewayApiKey, setGatewayApiKey] = useState('');
  const [gatewayUrl, setGatewayUrl] = useState('https://ai-gateway.vercel.app/v1');
  const [targetApiKey, setTargetApiKey] = useState('');
  const [dryRun, setDryRun] = useState<boolean>(true);
  const [showGatewayDrawer, setShowGatewayDrawer] = useState(false);
  const [input, setInput] = useState(
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');
    const userMessage: SandboxMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: userText,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const authConfig = targetApiKey.trim()
        ? {
            bearerToken: targetApiKey.trim(),
            apiKey: { name: 'Authorization', value: targetApiKey.trim(), in: 'header' as const },
          }
        : undefined;

      const res = await fetch('/api/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          model,
          apiKey: gatewayApiKey.trim() || undefined,
          gatewayUrl: gatewayUrl.trim() || undefined,
          targetApiKey: targetApiKey.trim() || undefined,
          authConfig,
          dryRun,
          spec,
          selectedOperationId: selectedOperation?.id,
        }),
      });

      const data = await res.json();
      if (data.content || data.toolCall) {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_${Date.now()}_res`,
            role: 'assistant',
            content: data.content,
            toolCall: data.toolCall,
            result: data.result,
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="font-semibold text-white flex items-center gap-1.5 font-mono shrink-0">
              <Globe className="h-4 w-4 text-zinc-300" />
              AI Gateway:
            </span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-zinc-500 cursor-pointer font-mono"
            >
              <option value="openai/gpt-4o">openai/gpt-4o</option>
              <option value="openai/gpt-4o-mini">openai/gpt-4o-mini</option>
              <option value="anthropic/claude-3-5-sonnet">anthropic/claude-3-5-sonnet</option>
              <option value="anthropic/claude-3-5-haiku">anthropic/claude-3-5-haiku</option>
              <option value="google/gemini-1.5-pro">google/gemini-1.5-pro</option>
              <option value="google/gemini-1.5-flash">google/gemini-1.5-flash</option>
              <option value="meta/llama-3.3-70b">meta/llama-3.3-70b</option>
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowGatewayDrawer(!showGatewayDrawer)}
              className={showGatewayDrawer ? 'border-white text-white' : ''}
            >
              <Settings2 className="h-3.5 w-3.5 mr-1" />
              <span className="hidden sm:inline">Gateway Settings</span>
              <span className="sm:hidden">Settings</span>
            </Button>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-0 border-t sm:border-t-0 border-zinc-800">
            <span className="font-mono text-zinc-400 text-xs">Dry-Run Simulation:</span>
            <Switch checked={dryRun} onChange={setDryRun} />
          </div>
        </div>

        {/* Vercel AI Gateway Drawer */}
        {showGatewayDrawer && (
          <div className="mt-3 pt-3 border-t border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
            <div>
              <label className="text-zinc-400 block mb-1">
                Vercel AI Gateway API Key
              </label>
              <Input
                type="password"
                value={gatewayApiKey}
                onChange={(e) => setGatewayApiKey(e.target.value)}
                placeholder="vck_... (or AI_GATEWAY_API_KEY)"
                className="text-xs bg-black"
              />
            </div>
            <div>
              <label className="text-zinc-400 block mb-1">
                AI Gateway Base URL
              </label>
              <Input
                value={gatewayUrl}
                onChange={(e) => setGatewayUrl(e.target.value)}
                placeholder="https://ai-gateway.vercel.app/v1"
                className="text-xs bg-black"
              />
            </div>
            <div>
              <label className="text-zinc-400 block mb-1">
                Target API Key (for live GETs)
              </label>
              <Input
                type="password"
                value={targetApiKey}
                onChange={(e) => setTargetApiKey(e.target.value)}
                placeholder="Upstream API key"
                className="text-xs bg-black"
              />
            </div>
          </div>
        )}
      </Card>

      {/* AI Elements: Message Scroller & Bubbles */}
      <Card className="flex-1 flex flex-col overflow-hidden bg-black border-zinc-800">
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-2.5 sm:gap-3.5 text-xs ${
                m.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {m.role === 'assistant' && (
                <div className="h-7 w-7 rounded bg-white text-black flex items-center justify-center shrink-0 font-bold shadow-xs">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div
                className={`max-w-[88%] sm:max-w-[80%] rounded-lg p-3.5 space-y-2.5 leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-zinc-900 border border-zinc-700 text-white shadow-xs'
                    : 'bg-zinc-950 border border-zinc-800 text-zinc-200'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>

                {/* AI Elements: Tool Invocation Card */}
                {m.toolCall && (
                  <div className="p-3 bg-black border border-zinc-800 rounded-md font-mono text-[11px] space-y-1.5 mt-2">
                    <div className="flex items-center justify-between text-zinc-400 border-b border-zinc-800 pb-1.5">
                      <span className="text-white font-semibold flex items-center gap-1.5 truncate">
                        <Terminal className="h-3.5 w-3.5 text-white shrink-0" />
                        <span className="truncate">Tool Invocation: {m.toolCall.name}</span>
                      </span>
                      <Badge variant="secondary" className="text-[9px] py-0 shrink-0 ml-1">
                        MCP Tool Call
                      </Badge>
                    </div>
                    <pre className="text-zinc-300 overflow-x-auto pt-1">
                      {JSON.stringify(m.toolCall.args, null, 2)}
                    </pre>
                  </div>
                )}

                {/* AI Elements: Token Diet Tool Result */}
                {m.result && (
                  <div className="p-3 bg-black border border-zinc-800 rounded-md font-mono text-[11px] space-y-1.5">
                    <div className="flex items-center justify-between text-zinc-400 border-b border-zinc-800 pb-1.5">
                      <span className="text-white font-semibold">Response Payload</span>
                      {m.result.savings !== undefined && (
                        <span className="text-zinc-300 text-[10px] bg-zinc-900 border border-zinc-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <TrendingDown className="h-3 w-3" />
                          Token Diet Savings: ~{m.result.savings}%
                        </span>
                      )}
                    </div>
                    <pre className="text-zinc-300 overflow-x-auto whitespace-pre pt-1 max-h-48">
                      {m.result.text}
                    </pre>
                  </div>
                )}
              </div>

              {m.role === 'user' && (
                <div className="h-7 w-7 rounded bg-zinc-800 text-white flex items-center justify-center shrink-0 border border-zinc-700">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2.5 text-xs text-zinc-400 font-mono pl-1">
              <Loader2 className="h-4 w-4 animate-spin text-white shrink-0" />
              <span className="truncate">Routing request via Vercel AI Gateway & executing tools...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* AI Elements: Chat Input Bar */}
        <div className="p-2.5 sm:p-3 border-t border-zinc-800 bg-zinc-950 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask the AI agent to invoke OpenAPI endpoints through Vercel AI Gateway..."
            className="flex-1 bg-black text-xs font-mono"
            disabled={isLoading}
          />
          {isLoading ? (
            <Button onClick={handleStop} variant="outline" size="icon" className="shrink-0 text-white border-zinc-700">
              <Square className="h-3.5 w-3.5 fill-white" />
            </Button>
          ) : (
            <Button onClick={handleSend} disabled={!input.trim()} size="icon" className="shrink-0">
              <Send className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
