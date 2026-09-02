'use client';

import React, { useState, useEffect } from 'react';
import { NormalizedSpec, MacroDefinition } from '@postmcp/types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/Dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/Tabs';
import { Copy, Check, Download, Save, CheckCircle2 } from 'lucide-react';

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
  const [isPersisting, setIsPersisting] = useState<boolean>(false);
  const [persistSuccess, setPersistSuccess] = useState<string | null>(null);
  const [configs, setConfigs] = useState<{
    cursor?: string;
    claude?: string;
    windsurf?: string;
    postmcp?: string;
  }>({});

  useEffect(() => {
    if (isOpen) {
      setPersistSuccess(null);
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

  const currentSnippet = configs[activeTab] || '';

  const handleCopy = () => {
    navigator.clipboard.writeText(currentSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToWorkspace = async () => {
    if (!configs.postmcp) return;
    setIsPersisting(true);
    try {
      const parsedConfig = JSON.parse(configs.postmcp);
      const res = await fetch('/api/persist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedConfig),
      });
      const data = await res.json();
      if (data.success) {
        setPersistSuccess(data.message || 'Saved postmcp.config.json');
      }
    } catch (err: any) {
      console.error('Failed to persist config:', err);
    } finally {
      setIsPersisting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-blue-400" />
            Export MCP Client Configuration
          </DialogTitle>
          <DialogDescription>
            1-Click configurations for Cursor, Claude Desktop, Windsurf, and PostMCP project persistence.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="cursor">Cursor</TabsTrigger>
              <TabsTrigger value="claude">Claude Desktop</TabsTrigger>
              <TabsTrigger value="windsurf">Windsurf</TabsTrigger>
              <TabsTrigger value="postmcp">postmcp.config.json</TabsTrigger>
            </TabsList>

            <div className="pt-3 space-y-3">
              {/* Optional Secret Injection */}
              <div className="p-3 bg-[#0d131f] border border-slate-800 rounded-lg space-y-2">
                <span className="text-xs font-semibold text-slate-300">
                  Optional: Inject Authentication Credential / Env Var
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Input
                    value={envKey}
                    onChange={(e) => setEnvKey(e.target.value)}
                    placeholder="Env Var (e.g. STRIPE_SECRET_KEY)"
                  />
                  <Input
                    value={envVal}
                    onChange={(e) => setEnvVal(e.target.value)}
                    type="password"
                    placeholder="Value or Reference"
                  />
                </div>
              </div>

              {/* Code Snippet Box */}
              <div className="relative">
                <pre className="p-4 bg-[#070a10] border border-slate-800/80 rounded-lg text-xs font-mono text-emerald-400 overflow-x-auto max-h-56 whitespace-pre">
                  {currentSnippet || 'Generating configuration snippet...'}
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

              {/* Persistence Alert */}
              {persistSuccess && (
                <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-xs text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{persistSuccess}</span>
                </div>
              )}
            </div>
          </Tabs>

          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleSaveToWorkspace}
              disabled={isPersisting}
            >
              <Save className="h-3.5 w-3.5 mr-1 text-blue-400" />
              {isPersisting ? 'Saving...' : 'Save to Workspace (postmcp.config.json)'}
            </Button>

            <Button variant="default" size="sm" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
