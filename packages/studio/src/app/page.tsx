'use client';

import React, { useState, useEffect } from 'react';
import { NormalizedSpec, NormalizedOperation, MacroDefinition } from '@postmcp/types';
import { Header } from '@/components/Header';
import { ApiExplorer } from '@/components/ApiExplorer';
import { EndpointDetail } from '@/components/EndpointDetail';
import { TokenDietCurator } from '@/components/TokenDietCurator';
import { MacroBuilder } from '@/components/MacroBuilder';
import { LiveSandbox } from '@/components/LiveSandbox';
import { PresetSelectorModal } from '@/components/PresetSelectorModal';
import { SpecIngestModal } from '@/components/SpecIngestModal';
import { ExportModal } from '@/components/ExportModal';
import { FileText, Sparkles, Workflow, Bot, Loader2 } from 'lucide-react';

export default function StudioPage() {
  const [spec, setSpec] = useState<NormalizedSpec | null>(null);
  const [presetId, setPresetId] = useState<string | undefined>('stripe');
  const [selectedOperation, setSelectedOperation] = useState<NormalizedOperation | null>(null);
  const [fieldMasks, setFieldMasks] = useState<Record<string, string[]>>({});
  const [macros, setMacros] = useState<MacroDefinition[]>([]);
  const [enabledOperations, setEnabledOperations] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'detail' | 'tokendiet' | 'macros' | 'sandbox'>('detail');

  const [isPresetsOpen, setIsPresetsOpen] = useState(false);
  const [isIngestOpen, setIsIngestOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial preset (Stripe) on mount
  const loadPreset = async (id: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presetId: id }),
      });
      const data = await res.json();
      if (data.spec) {
        setSpec(data.spec);
        setPresetId(id);
        setSelectedOperation(data.spec.operations[0] || null);
        setMacros(data.spec.macros || []);

        // Initialize enabled map
        const enabledMap: Record<string, boolean> = {};
        for (const op of data.spec.operations) {
          enabledMap[op.id] = true;
        }
        setEnabledOperations(enabledMap);

        // Initialize preset field masks if available
        if (data.spec.tokenDiet?.fieldMasks) {
          setFieldMasks(data.spec.tokenDiet.fieldMasks);
        }
      }
    } catch (err) {
      console.error('Failed to load preset:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleIngestSpec = async (payload: { spec?: string; url?: string }) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.spec) {
        setSpec(data.spec);
        setPresetId(undefined);
        setSelectedOperation(data.spec.operations[0] || null);
        setMacros(data.spec.macros || []);

        const enabledMap: Record<string, boolean> = {};
        for (const op of data.spec.operations) {
          enabledMap[op.id] = true;
        }
        setEnabledOperations(enabledMap);
      } else {
        throw new Error(data.error || 'Failed to parse spec.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    async function initSpec() {
      let initialSpec: string | null = null;
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        initialSpec = urlParams.get('spec') || urlParams.get('preset');
      }

      if (!initialSpec) {
        try {
          const res = await fetch('/api/initial-spec');
          const data = await res.json();
          if (data.initialSpec) {
            initialSpec = data.initialSpec;
          }
        } catch {
          // Ignore fetch errors
        }
      }

      if (initialSpec && initialSpec.trim()) {
        const trimmed = initialSpec.trim();
        if (trimmed.startsWith('@')) {
          loadPreset(trimmed.slice(1));
        } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          handleIngestSpec({ url: trimmed });
        } else {
          handleIngestSpec({ spec: trimmed });
        }
      } else {
        loadPreset('stripe');
      }
    }

    initSpec();
  }, []);

  const handleToggleOperation = (id: string, enabled: boolean) => {
    setEnabledOperations((prev) => ({ ...prev, [id]: enabled }));
  };

  const handleToggleAll = (enable: boolean) => {
    if (!spec) return;
    const next: Record<string, boolean> = {};
    for (const op of spec.operations) {
      next[op.id] = enable;
    }
    setEnabledOperations(next);
  };

  const handleUpdateFieldMask = (path: string, fields: string[]) => {
    setFieldMasks((prev) => ({ ...prev, [path]: fields }));
  };

  const handleAddMacro = (macro: MacroDefinition) => {
    setMacros((prev) => [...prev, macro]);
  };

  const handleDeleteMacro = (macroName: string) => {
    setMacros((prev) => prev.filter((m) => m.name !== macroName));
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#090d16]">
      {/* Top Header */}
      <Header
        spec={spec}
        presetId={presetId}
        onOpenPresets={() => setIsPresetsOpen(true)}
        onOpenIngest={() => setIsIngestOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
      />

      {/* Main Workspace Layout */}
      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="text-sm font-medium">Analyzing OpenAPI schema & generating MCP tools...</span>
        </div>
      ) : !spec ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4">
          <p className="text-sm">No specification loaded.</p>
          <button
            onClick={() => setIsPresetsOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium shadow"
          >
            Explore 60+ API Presets
          </button>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: API Explorer */}
          <ApiExplorer
            operations={spec.operations}
            selectedOperationId={selectedOperation?.id || null}
            onSelectOperation={(op) => setSelectedOperation(op)}
            enabledOperations={enabledOperations}
            onToggleOperation={handleToggleOperation}
            onToggleAll={handleToggleAll}
          />

          {/* Right Panel: Workbenches */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#070a10]">
            {/* Workbench Tab Bar */}
            <div className="flex items-center justify-between border-b border-slate-800/80 bg-[#0b101b] px-6">
              <div className="flex gap-6">
                <button
                  onClick={() => setActiveTab('detail')}
                  className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                    activeTab === 'detail'
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Endpoint Inspector
                </button>

                <button
                  onClick={() => setActiveTab('tokendiet')}
                  className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                    activeTab === 'tokendiet'
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Token Diet Curator
                </button>

                <button
                  onClick={() => setActiveTab('macros')}
                  className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                    activeTab === 'macros'
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Workflow className="h-3.5 w-3.5" />
                  Composite Macros ({macros.length})
                </button>

                <button
                  onClick={() => setActiveTab('sandbox')}
                  className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                    activeTab === 'sandbox'
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Bot className="h-3.5 w-3.5" />
                  Live AI Sandbox
                </button>
              </div>

              {selectedOperation && (
                <span className="text-xs font-mono text-slate-400 truncate max-w-xs">
                  {selectedOperation.method.toUpperCase()} {selectedOperation.path}
                </span>
              )}
            </div>

            {/* Workbench Tab Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'detail' && selectedOperation && (
                <EndpointDetail operation={selectedOperation} />
              )}

              {activeTab === 'tokendiet' && selectedOperation && (
                <TokenDietCurator
                  operation={selectedOperation}
                  fieldMasks={fieldMasks}
                  onUpdateFieldMask={handleUpdateFieldMask}
                />
              )}

              {activeTab === 'macros' && (
                <MacroBuilder
                  macros={macros}
                  operations={spec.operations}
                  onAddMacro={handleAddMacro}
                  onDeleteMacro={handleDeleteMacro}
                />
              )}

              {activeTab === 'sandbox' && (
                <LiveSandbox spec={spec} selectedOperation={selectedOperation} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <PresetSelectorModal
        isOpen={isPresetsOpen}
        onClose={() => setIsPresetsOpen(false)}
        onSelectPreset={loadPreset}
      />

      <SpecIngestModal
        isOpen={isIngestOpen}
        onClose={() => setIsIngestOpen(false)}
        onIngestSpec={handleIngestSpec}
      />

      {spec && (
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          spec={spec}
          presetId={presetId}
          fieldMasks={fieldMasks}
          macros={macros}
          enabledOperations={enabledOperations}
        />
      )}
    </div>
  );
}
