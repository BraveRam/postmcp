import React, { useState } from 'react';
import { NormalizedSpec, NormalizedOperation } from '@postmcp/types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { Bot, User, Play, Send, Sparkles, Terminal, CheckCircle2, ShieldCheck } from 'lucide-react';

interface LiveSandboxProps {
  spec: NormalizedSpec;
  selectedOperation: NormalizedOperation | null;
}

export function LiveSandbox({ spec, selectedOperation }: LiveSandboxProps) {
  const [model, setModel] = useState('gpt-4o');
  const [prompt, setPrompt] = useState(
    selectedOperation
      ? `Execute ${selectedOperation.id} with sample parameters`
      : 'List all resources and summarize status'
  );
  const [messages, setMessages] = useState<
    Array<{
      role: 'user' | 'assistant' | 'tool';
      content: string;
      toolCall?: { name: string; args: any };
      result?: any;
    }>
  >([
    {
      role: 'assistant',
      content: `Hello! I have loaded the **${spec.title}** MCP server with ${spec.operations.length} optimized tools mounted. What would you like me to do?`,
    },
  ]);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleSend = () => {
    if (!prompt.trim()) return;

    const userMsg = prompt.trim();
    setPrompt('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setIsSimulating(true);

    setTimeout(() => {
      const targetOp = selectedOperation || spec.operations[0];
      const mockArgs: Record<string, any> = {};

      if (targetOp.parameters) {
        for (const p of targetOp.parameters.slice(0, 2)) {
          mockArgs[p.name] = p.name.includes('id') ? '12345' : 'sample_val';
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `I will invoke the tool \`${targetOp.id}\` on the **${spec.title}** server.`,
          toolCall: {
            name: targetOp.id,
            args: mockArgs,
          },
          result: {
            text: `| Field | Value |\n|---|---|\n| id | \`${mockArgs.id || 'res_99812'}\` |\n| status | \`success\` |\n| processed_at | \`2026-09-02T12:00:00Z\` |`,
          },
        },
      ]);
      setIsSimulating(false);
    }, 600);
  };

  return (
    <div className="flex flex-col h-full bg-[#070a10] rounded-xl border border-slate-800/80 overflow-hidden">
      {/* Sandbox Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-[#0b101b]">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-blue-400" />
          <span className="text-xs font-semibold text-white">Live AI Agent Sandbox</span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-mono text-[11px]">Model:</span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="bg-[#0d131f] border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 font-mono focus:outline-none"
          >
            <option value="gpt-4o">GPT-4o (Vercel Gateway)</option>
            <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
            <option value="gemini-2-flash">Gemini 2.0 Flash</option>
            <option value="simulated">Simulated MCP Agent</option>
          </select>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
              className={`rounded-xl p-3 max-w-[85%] space-y-2.5 ${
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
                      Tool Call: {msg.toolCall.name}
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
                  <div className="text-[10px] text-slate-400 font-sans mb-1 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3 text-emerald-400" />
                    Response (Token Diet Markdown Table):
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
      </div>

      {/* Prompt Input */}
      <div className="p-3 border-t border-slate-800/80 bg-[#0b101b] flex items-center gap-2">
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask the AI agent to test tools or execute workflows..."
          className="flex-1 text-xs bg-[#0d131f]"
          disabled={isSimulating}
        />
        <Button size="sm" onClick={handleSend} disabled={isSimulating || !prompt.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
