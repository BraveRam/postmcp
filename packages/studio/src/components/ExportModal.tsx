import React, { useState, useEffect } from 'react';
import { NormalizedSpec, MacroDefinition } from '@postmcp/types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { X, Copy, Check, Download, Terminal, Code, Settings } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  spec: NormalizedSpec;
  presetId?: string;
  fieldMasks: Record<string, string[]>;
  macros: MacroDefinition[];
  enabledOperations: Record<string, boolean>;
}

export function ExportModal({
  isOpen,
  onClose,
  spec,
  presetId,
  fieldMasks,
  macros,
  enabledOperations,
}: ExportModalProps) {
  const [activeTab, setActiveTab] = useState<'cursor' | 'claude' | 'windsurf' | 'postmcp'>('cursor');
  const [envKey, setEnvKey] = useState<string>('API_KEY');
  const [envVal, setEnvVal] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [configs, setConfigs] = useState<{
    cursor?: string;
    claude?: string;
    windsurf?: string;
    postmcp?: string;
  }>({});

  useEffect(() => {
    if (isOpen) {
      fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specName: spec.title,
          presetId,
          baseUrl: spec.servers[0]?.url,
          envVars: envVal ? { [envKey]: envVal } : undefined,
          enabledOperations,
          fieldMasks,
          macros,
        }),
      })
        .then((res) => res.json())
        .then((data) => setConfigs(data))
        .catch(console.error);
    }
  }, [isOpen, envKey, envVal, activeTab]);

  if (!isOpen) return null;

  const currentSnippet = configs[activeTab] || '';

  const handleCopy = () => {
    navigator.clipboard.writeText(currentSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0b101b] border border-slate-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#0e1422]">
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Export Client MCP Configuration</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Client Tabs */}
        <div className="flex border-b border-slate-800 bg-[#090d16] px-6 pt-3 gap-4">
          <button
            onClick={() => setActiveTab('cursor')}
            className={`pb-2 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'cursor'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Cursor (.cursor/mcp.json)
          </button>
          <button
            onClick={() => setActiveTab('claude')}
            className={`pb-2 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'claude'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Claude Desktop (claude_desktop_config.json)
          </button>
          <button
            onClick={() => setActiveTab('windsurf')}
            className={`pb-2 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'windsurf'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Windsurf (mcp_config.json)
          </button>
          <button
            onClick={() => setActiveTab('postmcp')}
            className={`pb-2 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'postmcp'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            PostMCP (postmcp.config.json)
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4">
          {/* Auth Env Inputs */}
          <div className="p-3 bg-[#0d131f] border border-slate-800 rounded-lg space-y-2">
            <span className="text-xs font-semibold text-slate-300">Optional: Inject Secret Env Var</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Input
                value={envKey}
                onChange={(e) => setEnvKey(e.target.value)}
                placeholder="Environment Variable Name (e.g. STRIPE_SECRET_KEY)"
              />
              <Input
                value={envVal}
                onChange={(e) => setEnvVal(e.target.value)}
                type="password"
                placeholder="Optional Value / Reference (e.g. sk_test_...)"
              />
            </div>
          </div>

          {/* Snippet Display */}
          <div className="relative">
            <pre className="p-4 bg-[#070a10] border border-slate-800/80 rounded-lg text-xs font-mono text-emerald-400 overflow-x-auto max-h-64 whitespace-pre">
              {currentSnippet || 'Generating snippet...'}
            </pre>

            <button
              onClick={handleCopy}
              className="absolute top-3 right-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-md border border-slate-700/80 flex items-center gap-1.5 font-medium transition-colors shadow"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Snippet</span>
                </>
              )}
            </button>
          </div>

          {/* Direct CLI Command Tip */}
          <div className="p-3 bg-blue-950/30 border border-blue-800/40 rounded-lg flex items-center justify-between text-xs text-blue-300">
            <span className="font-mono">
              postmcp run {presetId ? `@${presetId}` : spec.servers[0]?.url || './spec.json'}
            </span>
            <span className="text-[11px] text-blue-400/80">Direct CLI Command</span>
          </div>

          <div className="flex items-center justify-end pt-2">
            <Button variant="default" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
