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
    <header className="h-14 border-b border-zinc-800 bg-black/95 backdrop-blur px-4 flex items-center justify-between sticky top-0 z-40">
      {/* Left: Branding & Spec Info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 font-bold text-white tracking-tight text-sm">
          <div className="h-6 w-6 rounded bg-white flex items-center justify-center text-black shadow-xs">
            <Zap className="h-3.5 w-3.5 fill-black text-black" />
          </div>
          <span className="text-white font-mono font-semibold">PostMCP</span>
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5">
            Studio
          </span>
        </div>

        <div className="h-4 w-[1px] bg-zinc-800 mx-1" />

        {spec ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-200">
              {spec.title}
            </span>
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
              v{spec.version || '1.0.0'}
            </Badge>
            {presetId && (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-zinc-300">
                @{presetId}
              </Badge>
            )}
            <span className="text-xs text-zinc-500 font-mono">
              ({spec.operations.length} tools)
            </span>
          </div>
        ) : (
          <span className="text-xs text-zinc-500">No OpenAPI specification loaded</span>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onOpenPresets}>
          <Layers className="h-3.5 w-3.5 text-zinc-300" />
          <span>60+ Presets</span>
        </Button>

        <Button variant="outline" size="sm" onClick={onOpenIngest}>
          <Upload className="h-3.5 w-3.5 text-zinc-300" />
          <span>Import Spec</span>
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={onOpenExport}
          disabled={!spec}
        >
          <Download className="h-3.5 w-3.5 mr-1" />
          <span>Export MCP Server</span>
        </Button>
      </div>
    </header>
  );
}
