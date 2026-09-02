import React from 'react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Sparkles, Download, Upload, Layers, Terminal, Zap, Menu } from 'lucide-react';
import { NormalizedSpec } from '@postmcp/types';

interface HeaderProps {
  spec: NormalizedSpec | null;
  presetId?: string;
  onOpenPresets: () => void;
  onOpenIngest: () => void;
  onOpenExport: () => void;
  onToggleMobileSidebar?: () => void;
  isMobileSidebarOpen?: boolean;
}

export function Header({
  spec,
  presetId,
  onOpenPresets,
  onOpenIngest,
  onOpenExport,
  onToggleMobileSidebar,
  isMobileSidebarOpen,
}: HeaderProps) {
  return (
    <header className="h-14 border-b border-zinc-800 bg-black/95 backdrop-blur px-3 sm:px-4 flex items-center justify-between sticky top-0 z-40">
      {/* Left: Branding & Spec Info */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {onToggleMobileSidebar && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleMobileSidebar}
            className="md:hidden text-zinc-400 hover:text-white"
            aria-label="Toggle endpoints navigation"
          >
            <Menu className="h-4 w-4" />
          </Button>
        )}

        <div className="flex items-center gap-1.5 sm:gap-2 font-bold text-white tracking-tight text-sm shrink-0">
          <div className="h-6 w-6 rounded bg-white flex items-center justify-center text-black shadow-xs">
            <Zap className="h-3.5 w-3.5 fill-black text-black" />
          </div>
          <span className="text-white font-sans font-semibold hidden xs:inline">PostMCP</span>
          <span className="text-[10px] font-sans uppercase tracking-wider text-zinc-400 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 hidden sm:inline">
            Studio
          </span>
        </div>

        <div className="h-4 w-[1px] bg-zinc-800 mx-1 hidden sm:block" />

        {spec ? (
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="text-xs font-semibold text-zinc-200 truncate max-w-[100px] xs:max-w-[160px] sm:max-w-[220px] md:max-w-xs">
              {spec.title}
            </span>
            <Badge variant="secondary" className="text-[10px] py-0 px-1 hidden sm:inline-flex shrink-0">
              v{spec.version || '1.0.0'}
            </Badge>
            {presetId && (
              <Badge variant="outline" className="text-[10px] py-0 px-1 text-zinc-300 hidden md:inline-flex shrink-0">
                @{presetId}
              </Badge>
            )}
            <span className="text-xs text-zinc-500 font-sans hidden lg:inline shrink-0">
              ({spec.operations.length} tools)
            </span>
          </div>
        ) : (
          <span className="text-xs text-zinc-500 hidden sm:inline truncate">No spec loaded</span>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <Button variant="outline" size="sm" onClick={onOpenPresets} className="px-2 sm:px-3">
          <Layers className="h-3.5 w-3.5 text-zinc-300" />
          <span className="hidden sm:inline">60+ Presets</span>
          <span className="sm:hidden">Presets</span>
        </Button>

        <Button variant="outline" size="sm" onClick={onOpenIngest} className="px-2 sm:px-3">
          <Upload className="h-3.5 w-3.5 text-zinc-300" />
          <span className="hidden sm:inline">Import Spec</span>
          <span className="sm:hidden">Import</span>
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={onOpenExport}
          disabled={!spec}
          className="px-2.5 sm:px-3.5"
        >
          <Download className="h-3.5 w-3.5 sm:mr-1" />
          <span className="hidden sm:inline">Export MCP</span>
          <span className="sm:hidden">Export</span>
        </Button>
      </div>
    </header>
  );
}
