'use client';

import React, { useState, useEffect } from 'react';
import { NormalizedSpec, MacroDefinition } from '@postmcp/types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/Dialog';
import { Tabs, TabsList, TabsTrigger } from './ui/Tabs';
import { Copy, Check, Download, Save, CheckCircle2, Plus, Trash2 } from 'lucide-react';

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
  const [envVars, setEnvVars] = useState<Array<{ id: string; key: string; val: string }>>([
    { id: 'env_1', key: 'API_KEY', val: '' },
  ]);
  const [copied, setCopied] = useState<boolean>(false);
  const [isPersisting, setIsPersisting] = useState<boolean>(false);
  const [persistSuccess, setPersistSuccess] = useState<string | null>(null);
  const [configs, setConfigs] = useState<{
    cursor?: string;
    claude?: string;
    windsurf?: string;
    postmcp?: string;
  }>({});

  const handleAddEnv = () => {
    if (envVars.length >= 10) return;
    setEnvVars((prev) => [
      ...prev,
      { id: `env_${Date.now()}_${prev.length}`, key: '', val: '' },
    ]);
  };

  const handleRemoveEnv = (id: string) => {
    if (envVars.length <= 1) {
      setEnvVars([{ id: 'env_1', key: '', val: '' }]);
      return;
    }
    setEnvVars((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateEnv = (id: string, field: 'key' | 'val', value: string) => {
    setEnvVars((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  useEffect(() => {
    if (isOpen) {
      setPersistSuccess(null);
      const envMap: Record<string, string> = {};
      for (const item of envVars) {
        if (item.key.trim()) {
          envMap[item.key.trim()] = item.val;
        }
      }

      fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specName: spec.title,
          presetId,
          baseUrl: spec.servers[0]?.url,
          envVars: Object.keys(envMap).length > 0 ? envMap : undefined,
          enabledOperations,
          fieldMasks,
          macros,
        }),
      })
        .then((res) => res.json())
        .then((data) => setConfigs(data))
        .catch(console.error);
    }
  }, [isOpen, envVars, activeTab]);

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
        setPersistSuccess(data.message || 'Saved postmcp.config.json to workspace disk');
      }
    } catch (err: any) {
      console.error('Failed to persist config:', err);
    } finally {
      setIsPersisting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-zinc-950 border-zinc-800 text-white font-sans">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-4 w-4 text-white" />
            Export MCP Client Configuration
          </DialogTitle>
          <DialogDescription>
            1-Click configurations for Cursor, Claude Desktop, Windsurf, and PostMCP project persistence.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)}>
            <TabsList className="grid grid-cols-4 w-full bg-black border-zinc-800">
              <TabsTrigger value="cursor">Cursor</TabsTrigger>
              <TabsTrigger value="claude">Claude Desktop</TabsTrigger>
              <TabsTrigger value="windsurf">Windsurf</TabsTrigger>
              <TabsTrigger value="postmcp">postmcp.config.json</TabsTrigger>
            </TabsList>

            <div className="pt-3 space-y-3">
              {/* Optional Secret Injection: Up to 10 environment variables */}
              <div className="p-3 bg-black border border-zinc-800 rounded-md space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300 font-sans">
                    Optional: Inject Authentication Credentials / Env Vars ({envVars.length}/10)
                  </span>
                  {envVars.length < 10 && (
                    <button
                      type="button"
                      onClick={handleAddEnv}
                      className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 font-sans transition-colors cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      Add Variable
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {envVars.map((env, index) => (
                    <div key={env.id} className="flex items-center gap-2 text-xs">
                      <Input
                        value={env.key}
                        onChange={(e) => handleUpdateEnv(env.id, 'key', e.target.value)}
                        placeholder={`KEY_${index + 1} (e.g. STRIPE_API_KEY)`}
                        className="bg-zinc-950 flex-1 font-sans text-xs h-8"
                      />
                      <Input
                        value={env.val}
                        onChange={(e) => handleUpdateEnv(env.id, 'val', e.target.value)}
                        type="password"
                        placeholder="Value or Reference"
                        className="bg-zinc-950 flex-1 font-sans text-xs h-8"
                      />
                      {envVars.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveEnv(env.id)}
                          className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded transition-colors cursor-pointer shrink-0"
                          title="Remove variable"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Code Snippet Box */}
              <div className="relative">
                <pre className="p-4 bg-black border border-zinc-800 rounded-md text-xs font-sans text-zinc-200 overflow-x-auto max-h-56 whitespace-pre">
                  {currentSnippet || 'Generating configuration snippet...'}
                </pre>

                <button
                  onClick={handleCopy}
                  className="absolute top-3 right-3 px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs rounded border border-zinc-700 flex items-center gap-1.5 font-medium transition-colors shadow-xs cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-white" />
                      <span className="text-white font-sans">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span className="font-sans">Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Persistence Alert */}
              {persistSuccess && (
                <div className="p-2.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-200 flex items-center gap-2 font-sans">
                  <CheckCircle2 className="h-4 w-4 text-white shrink-0" />
                  <span>{persistSuccess}</span>
                </div>
              )}
            </div>
          </Tabs>

          <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleSaveToWorkspace}
              disabled={isPersisting}
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              {isPersisting ? 'Saving...' : 'Save to Workspace'}
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
