'use client';

import React, { useState, useEffect } from 'react';
import { NormalizedSpec, NormalizedOperation, MacroDefinition } from '@postmcp/types';
import { Header } from '@/components/Header';
import { ApiExplorer } from '@/components/ApiExplorer';
import { EndpointDetail } from '@/components/EndpointDetail';
import { TokenDietCurator } from '@/components/TokenDietCurator';
import { MacroBuilder } from '@/components/MacroBuilder';
import { LiveSandbox, type SandboxMessage } from '@/components/LiveSandbox';
import { LiveSandboxModal } from '@/components/LiveSandboxModal';
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
  const [isSandboxModalOpen, setIsSandboxModalOpen] = useState(false);
  const [sandboxMessages, setSandboxMessages] = useState<SandboxMessage[]>([]);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(320);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState<boolean>(false);
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
    } catch (err: unknown) {
      console.error('Failed to parse spec:', err);
      throw err;
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

  // Restore saved sidebar width
  useEffect(() => {
    try {
      const saved = localStorage.getItem('postmcp_sidebar_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 220 && parsed <= 800) {
          setSidebarWidth(parsed);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Global mouse move and up listeners for resizing
  useEffect(() => {
    if (!isDraggingSidebar) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(220, Math.min(800, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDraggingSidebar(false);
      try {
        localStorage.setItem('postmcp_sidebar_width', sidebarWidth.toString());
      } catch {
        // Ignore localStorage errors
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSidebar, sidebarWidth]);

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
    <div
      className={`flex flex-col h-screen overflow-hidden bg-background text-foreground font-sans ${
        isDraggingSidebar ? 'select-none cursor-col-resize' : ''
      }`}
    >
      {/* Top Header */}
      <Header
        spec={spec}
        presetId={presetId}
        onOpenPresets={() => setIsPresetsOpen(true)}
        onOpenIngest={() => setIsIngestOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenSandbox={() => setIsSandboxModalOpen(true)}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        isMobileSidebarOpen={isMobileSidebarOpen}
      />

      {/* Main Workspace Layout */}
      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 font-sans p-4 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-foreground" />
          <span className="text-xs">Analyzing OpenAPI schema & generating MCP tools...</span>
        </div>
      ) : !spec ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4 font-sans p-4 text-center">
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
          {/* Desktop Left Panel: API Explorer with Drag Resizer */}
          <div
            className="hidden md:block shrink-0 h-full relative"
            style={{ width: `${sidebarWidth}px` }}
          >
            <ApiExplorer
              operations={spec.operations}
              selectedOperationId={selectedOperation?.id || null}
              onSelectOperation={(op) => setSelectedOperation(op)}
              enabledOperations={enabledOperations}
              onToggleOperation={handleToggleOperation}
              onToggleAll={handleToggleAll}
            />

            {/* Draggable vertical resize divider */}
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                setIsDraggingSidebar(true);
              }}
              className={`absolute top-0 -right-1 w-2.5 h-full cursor-col-resize z-30 group flex items-center justify-center transition-colors select-none ${
                isDraggingSidebar ? 'bg-border' : 'hover:bg-muted'
              }`}
              title="Drag horizontally to resize sidebar"
            >
              <div
                className={`w-0.5 h-7 rounded-full transition-colors ${
                  isDraggingSidebar ? 'bg-foreground scale-y-125' : 'bg-muted-foreground/40 group-hover:bg-foreground'
                }`}
              />
            </div>
          </div>

          {/* Mobile Drawer Left Panel: API Explorer */}
          {isMobileSidebarOpen && (
            <div className="fixed inset-0 z-50 md:hidden flex bg-black/60 backdrop-blur-xs">
              <div className="w-4/5 max-w-sm h-full bg-background border-r border-border shadow-2xl animate-in slide-in-from-left duration-200">
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
          <div className="flex-1 flex flex-col overflow-hidden bg-background min-w-0">
            {/* Workbench Tab Bar */}
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 sm:px-6 shrink-0 overflow-x-auto">
              <div className="flex items-center gap-3 sm:gap-6 min-w-max">
                <button
                  onClick={() => setActiveTab('detail')}
                  className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer font-sans whitespace-nowrap ${
                    activeTab === 'detail'
                      ? 'border-foreground text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden xs:inline">Endpoint</span> Inspector
                </button>

                <button
                  onClick={() => setActiveTab('tokendiet')}
                  className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer font-sans whitespace-nowrap ${
                    activeTab === 'tokendiet'
                      ? 'border-foreground text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  Token Diet
                </button>

                <button
                  onClick={() => setActiveTab('macros')}
                  className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer font-sans whitespace-nowrap ${
                    activeTab === 'macros'
                      ? 'border-foreground text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Workflow className="h-3.5 w-3.5 shrink-0" />
                  Macros ({macros.length})
                </button>

                <button
                  onClick={() => {
                    setActiveTab('sandbox');
                    setIsSandboxModalOpen(true);
                  }}
                  className={`py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer font-sans whitespace-nowrap ${
                    activeTab === 'sandbox'
                      ? 'border-foreground text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Bot className="h-3.5 w-3.5 shrink-0" />
                  AI Sandbox
                </button>
              </div>

              {selectedOperation && (
                <div className="hidden lg:flex items-center gap-1.5 text-xs font-sans text-muted-foreground truncate max-w-xs ml-4">
                  <span className="font-semibold text-foreground">{selectedOperation.method.toUpperCase()}</span>
                  <span className="truncate">{selectedOperation.path}</span>
                </div>
              )}
            </div>

            {/* Workbench Tab Content */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 bg-background">
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
                <div className="space-y-4 max-w-5xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-card border border-border shadow-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold text-foreground font-sans">PostMCP Live AI Sandbox</h3>
                      </div>
                      <p className="text-xs text-muted-foreground font-sans mt-0.5">
                        Interactive fullscreen chatbot modal for comprehensive tool dispatching, markdown rendering, and Token Diet analysis.
                      </p>
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setIsSandboxModalOpen(true)}
                      className="font-sans text-xs flex items-center gap-1.5 shrink-0"
                    >
                      <Bot className="h-3.5 w-3.5" />
                      <span>Fullscreen</span>
                    </Button>
                  </div>

                  <LiveSandbox
                    spec={spec}
                    selectedOperation={selectedOperation}
                    onOpenModal={() => setIsSandboxModalOpen(true)}
                    messages={sandboxMessages}
                    onMessagesChange={setSandboxMessages}
                  />
                </div>
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

      {spec && (
        <LiveSandboxModal
          isOpen={isSandboxModalOpen}
          onClose={() => setIsSandboxModalOpen(false)}
          spec={spec}
          selectedOperation={selectedOperation}
          messages={sandboxMessages}
          onMessagesChange={setSandboxMessages}
        />
      )}
    </div>
  );
}
