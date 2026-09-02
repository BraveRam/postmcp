'use client';

import React, { useState } from 'react';
import { NormalizedSpec, NormalizedOperation } from '@postmcp/types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { ScrollArea } from './ui/ScrollArea';
import { Bot, User, Send, Sparkles, Terminal, ShieldCheck, KeyRound, Loader2 } from 'lucide-react';

interface LiveSandboxProps {
  spec: NormalizedSpec;
  selectedOperation: NormalizedOperation | null;
}

export function LiveSandbox({ spec, selectedOperation }: LiveSandboxProps) {
  const [model, setModel] = useState('gpt-4o');
  const [apiKey, setApiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
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
      content: `Hello! The **${spec.title}** MCP server is mounted with **${spec.operations.length} context-optimized tools**. Ask me anything to test real tool dispatching and Token Diet output.`,
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
      const res = await fetch('/api/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          model,
          apiKey: apiKey.trim() || undefined,
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
      console.error('Sandbox error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#070a10] rounded-xl border border-slate-800/80 overflow-hidden">
      {/* Header Controls */}
      <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between bg-[#0b101b]">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-blue-400" />
          <span className="text-xs font-semibold text-white">Vercel AI SDK Sandbox</span>
          <Badge variant="secondary" className="text-[10px] font-mono">
            v4.1
          </Badge>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <button
            onClick={() => setShowKeyInput(!showKeyInput)}
            className="text-[11px] text-slate-400 hover:text-blue-400 flex items-center gap-1 transition-colors"
          >
            <KeyRound className="h-3 w-3" />
            <span>{apiKey ? 'Custom Key Set' : 'Add API Key'}</span>
          </button>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-mono text-[11px]">Model:</span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="bg-[#0d131f] border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 font-mono focus:outline-none"
            >
              <option value="gpt-4o">GPT-4o (Vercel Gateway)</option>
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
              <option value="gemini-2-flash">Gemini 2.0 Flash</option>
            </select>
          </div>
        </div>
      </div>

      {/* Key Input Banner */}
      {showKeyInput && (
        <div className="p-3 bg-[#0d131f] border-b border-slate-800 flex items-center gap-2">
          <KeyRound className="h-3.5 w-3.5 text-blue-400 shrink-0" />
          <Input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            type="password"
            placeholder="OpenAI / Vercel AI Gateway API Key (optional - simulated sandbox active if omitted)"
            className="text-xs h-7 bg-[#070a10]"
          />
        </div>
      )}

      {/* Chat Transcript Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-3xl mx-auto">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 text-xs leading-relaxed ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role !== 'user' && (
                <div className="h-6 w-6 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                  <Bot className="h-3.5 w-3.5" />
                </div>
              )}

              <div
                className={`rounded-xl p-3.5 max-w-[85%] space-y-2.5 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-[#0d131f] border border-slate-800 text-slate-200'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {msg.toolCall && (
                  <div className="p-2.5 bg-[#070a10] border border-blue-500/30 rounded-lg space-y-1.5 font-mono text-[11px]">
                    <div className="flex items-center justify-between text-blue-400 font-semibold">
                      <span className="flex items-center gap-1">
                        <Terminal className="h-3 w-3" />
                        Tool Invocation: {msg.toolCall.name}
                      </span>
                      <Badge variant="success" className="text-[9px] px-1 py-0">
                        Executed
                      </Badge>
                    </div>
                    <pre className="text-slate-400 overflow-x-auto">
                      {JSON.stringify(msg.toolCall.args, null, 2)}
                    </pre>
                  </div>
                )}

                {msg.result && (
                  <div className="p-2.5 bg-[#070a10] border border-emerald-500/30 rounded-lg font-mono text-[11px] text-emerald-400">
                    <div className="text-[10px] text-slate-400 font-sans mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3 text-emerald-400" />
                        Token Diet Response
                      </span>
                      {msg.result.savings !== undefined && (
                        <span className="text-emerald-400 font-semibold">
                          -{msg.result.savings}% Tokens
                        </span>
                      )}
                    </div>
                    <pre className="overflow-x-auto whitespace-pre-wrap">{msg.result.text}</pre>
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="h-6 w-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0">
                  <User className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 text-xs justify-start items-center text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
              <span>AI Agent reasoning & executing MCP tool call...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Bar */}
      <div className="p-3 border-t border-slate-800/80 bg-[#0b101b] flex items-center gap-2">
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask the AI model to call any endpoint tool..."
          className="flex-1 text-xs bg-[#0d131f]"
          disabled={isLoading}
        />
        <Button size="sm" onClick={handleSend} disabled={isLoading || !prompt.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
