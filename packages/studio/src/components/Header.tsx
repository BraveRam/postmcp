import React from 'react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Sparkles, Download, Upload, Layers, Terminal, Zap } from 'lucide-react';
import { NormalizedSpec } from '@postmcp/types';

interface HeaderProps {
  spec: NormalizedSpec | null;
  presetId?: string;
  onOpenPresets: () => void;
  onOpenIngest: () => void;
  onOpenExport: () => void;
}

export function Header({
  spec,
  presetId,
  onOpenPresets,
  onOpenIngest,
  onOpenExport,
}: HeaderProps) {
  return (
    <header className="h-14 border-b border-slate-800/80 bg-[#090d16]/90 backdrop-blur px-4 flex items-center justify-between sticky top-0 z-40">
      {/* Left: Branding & Spec Info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 font-bold text-white tracking-tight text-base">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/30">
            <Zap className="h-4 w-4 fill-white" />
          </div>
          <span>PostMCP</span>
          <span className="text-xs font-normal text-blue-400 bg-blue-950/60 border border-blue-800/40 rounded px-1.5 py-0.2">
            Studio
          </span>
        </div>

        <div className="h-4 w-[1px] bg-slate-800 mx-1" />

        {spec ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-200">
              {spec.title}
            </span>
            <Badge variant="secondary" className="text-[10px]">
              v{spec.version}
            </Badge>
            {presetId && (
              <Badge variant="default" className="text-[10px]">
                @{presetId}
              </Badge>
            )}
            <span className="text-xs text-slate-400 font-mono">
              ({spec.operations.length} tools)
            </span>
          </div>
        ) : (
          <span className="text-xs text-slate-500">No OpenAPI specification loaded</span>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onOpenPresets}>
          <Layers className="h-3.5 w-3.5 text-blue-400" />
          <span>60+ Presets</span>
        </Button>

        <Button variant="outline" size="sm" onClick={onOpenIngest}>
          <Upload className="h-3.5 w-3.5 text-slate-400" />
          <span>Import Spec</span>
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={onOpenExport}
          disabled={!spec}
          className="bg-blue-600 hover:bg-blue-500"
        >
          <Download className="h-3.5 w-3.5 mr-1" />
          <span>Export MCP Config</span>
        </Button>
      </div>
    </header>
  );
}
