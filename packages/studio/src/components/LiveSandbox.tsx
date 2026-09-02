'use client';

import React, { useState } from 'react';
import { NormalizedSpec, NormalizedOperation } from '@postmcp/types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { Switch } from './ui/Switch';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card';
import { ScrollArea } from './ui/ScrollArea';
import {
  Bot,
  User,
  Send,
  Sparkles,
  Terminal,
  Shield,
  KeyRound,
  Loader2,
  Lock,
} from 'lucide-react';

interface LiveSandboxProps {
  spec: NormalizedSpec;
  selectedOperation: NormalizedOperation | null;
}

export function LiveSandbox({ spec, selectedOperation }: LiveSandboxProps) {
  const [model, setModel] = useState('gpt-4o');
  const [aiApiKey, setAiApiKey] = useState('');
  const [targetApiKey, setTargetApiKey] = useState('');
  const [dryRun, setDryRun] = useState<boolean>(true);
  const [showSecurityDrawer, setShowSecurityDrawer] = useState(false);
  const [prompt, setPrompt] = useState(
    selectedOperation
      ? `Execute ${selectedOperation.id} with valid parameters`
      : 'List all resources and summarize status'
  );
  const [messages, setMessages] = useState<
    Array<{
      role: 'user' | 'assistant';
      content: string;
      toolCall?: { name: string; args: any };
      result?: { text: string; savings?: number };
    }>
  >([
    {
      role: 'assistant',
      content: `Hello! The **${spec.title}** MCP server is mounted with **${spec.operations.length} context-optimized tools** and **Dry-Run Protection Active**. Ask me anything to test real tool dispatching and Token Diet output.`,
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!prompt.trim() || isLoading) return;

    const userMsg = prompt.trim();
    setPrompt('');
    const newMessages = [...messages, { role: 'user' as const, content: userMsg }];
    setMessages(newMessages);
    setIsLoading(true);

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
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          model,
          apiKey: aiApiKey.trim() || undefined,
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
            role: 'assistant',
            content: data.content,
            toolCall: data.toolCall,
            result: data.result,
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error running sandbox: ${err.message}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-w-5xl space-y-4">
      {/* Top Configuration Bar */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-white flex items-center gap-1.5 font-mono">
              <Bot className="h-4 w-4 text-zinc-300" />
              Model:
            </span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-zinc-500 cursor-pointer font-mono"
            >
              <option value="gpt-4o">OpenAI GPT-4o</option>
              <option value="gpt-4o-mini">OpenAI GPT-4o-mini</option>
              <option value="claude-3-5-sonnet-latest">Claude 3.5 Sonnet</option>
              <option value="claude-3-5-haiku-latest">Claude 3.5 Haiku</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
              <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSecurityDrawer(!showSecurityDrawer)}
              className={showSecurityDrawer ? 'border-white text-white' : ''}
            >
              <KeyRound className="h-3.5 w-3.5 mr-1" />
              Credentials & Keys
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-zinc-400">Dry-Run Simulation:</span>
              <Switch checked={dryRun} onChange={setDryRun} />
            </div>
          </div>
        </div>

        {/* Security Drawer */}
        {showSecurityDrawer && (
          <div className="mt-3 pt-3 border-t border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-zinc-400 font-mono block mb-1">
                LLM Provider API Key (Optional)
              </label>
              <Input
                type="password"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                placeholder="sk-... (leave empty for simulated client)"
                className="text-xs"
              />
            </div>
            <div>
              <label className="text-zinc-400 font-mono block mb-1">
                Target API Key / Bearer Token
              </label>
              <Input
                type="password"
                value={targetApiKey}
                onChange={(e) => setTargetApiKey(e.target.value)}
                placeholder="API Key for live upstream requests"
                className="text-xs"
              />
            </div>
          </div>
        )}
      </Card>

      {/* Chat Messages Area */}
      <Card className="flex-1 flex flex-col overflow-hidden bg-black">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-3 text-xs ${
                m.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {m.role === 'assistant' && (
                <div className="h-7 w-7 rounded bg-white text-black flex items-center justify-center shrink-0 font-bold">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div
                className={`max-w-[80%] rounded-lg p-3.5 space-y-2 leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-zinc-900 border border-zinc-700 text-white'
                    : 'bg-zinc-950 border border-zinc-800 text-zinc-200'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>

                {/* Tool Call Rendering */}
                {m.toolCall && (
                  <div className="p-2.5 bg-black border border-zinc-800 rounded font-mono text-[11px] space-y-1 mt-2">
                    <div className="flex items-center justify-between text-zinc-400 border-b border-zinc-800/80 pb-1">
                      <span className="text-white font-semibold flex items-center gap-1.5">
                        <Terminal className="h-3 w-3 text-white" />
                        Tool Invocation: {m.toolCall.name}
                      </span>
                      <Badge variant="secondary" className="text-[9px] py-0">
                        MCP Call
                      </Badge>
                    </div>
                    <pre className="text-zinc-300 overflow-x-auto pt-1">
                      {JSON.stringify(m.toolCall.args, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Tool Result Rendering */}
                {m.result && (
                  <div className="p-2.5 bg-black border border-zinc-800 rounded font-mono text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-zinc-400 border-b border-zinc-800/80 pb-1">
                      <span className="text-white font-semibold">Response Payload</span>
                      {m.result.savings !== undefined && (
                        <span className="text-zinc-400 text-[10px]">
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
                <div className="h-7 w-7 rounded bg-zinc-800 text-white flex items-center justify-center shrink-0">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
              <Loader2 className="h-4 w-4 animate-spin text-white" />
              <span>Synthesizing tool parameters & executing sandbox request...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-zinc-800 bg-zinc-950 flex gap-2">
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask the AI agent to invoke OpenAPI endpoints..."
            className="flex-1 bg-black text-xs"
            disabled={isLoading}
          />
          <Button onClick={handleSend} disabled={isLoading || !prompt.trim()}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
