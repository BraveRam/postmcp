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
import { FileText, Sparkles, Workflow, Bot, Loader2, ListFilter } from 'lucide-react';
import { Button } from '@/components/ui/Button';

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
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
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
    } catch (err: any) {
      console.error('Failed to parse spec:', err);
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
    <div className="flex flex-col h-screen overflow-hidden bg-black text-zinc-100">
      {/* Top Header */}
      <Header
        spec={spec}
        presetId={presetId}
        onOpenPresets={() => setIsPresetsOpen(true)}
        onOpenIngest={() => setIsIngestOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        isMobileSidebarOpen={isMobileSidebarOpen}
      />

      {/* Main Workspace Layout */}
      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 gap-3 font-sans p-4 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
          <span className="text-xs">Analyzing OpenAPI schema & generating MCP tools...</span>
        </div>
      ) : !spec ? (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 gap-4 font-sans p-4 text-center">
          <p className="text-xs">No specification loaded.</p>
          <Button
            onClick={() => setIsPresetsOpen(true)}
            variant="default"
          >
            Explore 60+ API Presets
          </Button>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden relative">
          {/* Desktop Left Panel: API Explorer */}
          <div className="hidden md:block shrink-0">
            <ApiExplorer
              operations={spec.operations}
              selectedOperationId={selectedOperation?.id || null}
              onSelectOperation={(op) => setSelectedOperation(op)}
              enabledOperations={enabledOperations}
              onToggleOperation={handleToggleOperation}
              onToggleAll={handleToggleAll}
            />
          </div>

          {/* Mobile Drawer Left Panel: API Explorer */}
          {isMobileSidebarOpen && (
            <div className="fixed inset-0 z-50 md:hidden flex bg-black/80 backdrop-blur-xs">
              <div className="w-4/5 max-w-sm h-full bg-zinc-950 border-r border-zinc-800 shadow-2xl animate-in slide-in-from-left duration-200">
                <ApiExplorer
                  operations={spec.operations}
                  selectedOperationId={selectedOperation?.id || null}
                  onSelectOperation={(op) => {
                    setSelectedOperation(op);
                    setIsMobileSidebarOpen(false);
                  }}
                  enabledOperations={enabledOperations}
                  onToggleOperation={handleToggleOperation}
                  onToggleAll={handleToggleAll}
                  onCloseMobile={() => setIsMobileSidebarOpen(false)}
                />
              </div>
              <div
                className="flex-1"
                onClick={() => setIsMobileSidebarOpen(false)}
              />
            </div>
          )}

          {/* Right Panel: Workbenches */}
          <div className="flex-1 flex flex-col overflow-hidden bg-black min-w-0">
            {/* Workbench Tab Bar */}
            <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-3 sm:px-6 shrink-0 overflow-x-auto">
              <div className="flex items-center gap-3 sm:gap-6 min-w-max">
                <button
                  onClick={() => setActiveTab('detail')}
                  className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer font-sans whitespace-nowrap ${
                    activeTab === 'detail'
                      ? 'border-white text-white'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden xs:inline">Endpoint</span> Inspector
                </button>

                <button
                  onClick={() => setActiveTab('tokendiet')}
                  className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer font-sans whitespace-nowrap ${
                    activeTab === 'tokendiet'
                      ? 'border-white text-white'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  Token Diet
                </button>

                <button
                  onClick={() => setActiveTab('macros')}
                  className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer font-sans whitespace-nowrap ${
                    activeTab === 'macros'
                      ? 'border-white text-white'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Workflow className="h-3.5 w-3.5 shrink-0" />
                  Macros ({macros.length})
                </button>

                <button
                  onClick={() => setActiveTab('sandbox')}
                  className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer font-sans whitespace-nowrap ${
                    activeTab === 'sandbox'
                      ? 'border-white text-white'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Bot className="h-3.5 w-3.5 shrink-0" />
                  AI Sandbox
                </button>
              </div>

              {selectedOperation && (
                <div className="hidden lg:flex items-center gap-1.5 text-xs font-sans text-zinc-500 truncate max-w-xs ml-4">
                  <span className="text-zinc-400 font-semibold">{selectedOperation.method.toUpperCase()}</span>
                  <span className="truncate">{selectedOperation.path}</span>
                </div>
              )}
            </div>

            {/* Workbench Tab Content */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 bg-black">
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
