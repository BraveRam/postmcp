import React from 'react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Sparkles, Download, Upload, Layers, Terminal, Zap, Menu, Bot, BookOpen } from 'lucide-react';
import { NormalizedSpec } from '@postmcp/types';
import { ModeToggle } from './mode-toggle';

interface HeaderProps {
  spec: NormalizedSpec | null;
  presetId?: string;
  onOpenPresets: () => void;
  onOpenIngest: () => void;
  onOpenExport: () => void;
  onOpenSandbox?: () => void;
  onToggleMobileSidebar?: () => void;
  isMobileSidebarOpen?: boolean;
}

export function Header({
  spec,
  presetId,
  onOpenPresets,
  onOpenIngest,
  onOpenExport,
  onOpenSandbox,
  onToggleMobileSidebar,
  isMobileSidebarOpen,
}: HeaderProps) {
  return (
    <header className="h-14 border-b border-border bg-background/95 backdrop-blur px-3 sm:px-4 flex items-center justify-between sticky top-0 z-40">
      {/* Left: Branding & Spec Info */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {onToggleMobileSidebar && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleMobileSidebar}
            className="md:hidden text-muted-foreground hover:text-foreground"
            aria-label="Toggle endpoints navigation"
          >
            <Menu className="h-4 w-4" />
          </Button>
        )}

        <div className="flex items-center gap-1.5 sm:gap-2 font-bold text-foreground tracking-tight text-sm shrink-0">
          <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-primary-foreground shadow-xs">
            <Zap className="h-3.5 w-3.5 fill-primary-foreground text-primary-foreground" />
          </div>
          <span className="text-foreground font-sans font-semibold hidden xs:inline">PostMCP</span>
          <span className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5 hidden sm:inline">
            Studio
          </span>
        </div>

        <div className="h-4 w-[1px] bg-border mx-1 hidden sm:block" />

        {spec ? (
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="text-xs font-semibold text-foreground truncate max-w-[100px] xs:max-w-[160px] sm:max-w-[220px] md:max-w-xs">
              {spec.title}
            </span>
            <Badge variant="secondary" className="text-[10px] py-0 px-1 hidden sm:inline-flex shrink-0">
              v{spec.version || '1.0.0'}
            </Badge>
            {presetId && (
              <Badge variant="outline" className="text-[10px] py-0 px-1 hidden md:inline-flex shrink-0">
                @{presetId}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground font-sans hidden lg:inline shrink-0">
              ({spec.operations.length} tools)
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground hidden sm:inline truncate">No spec loaded</span>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <Button variant="outline" size="sm" onClick={onOpenPresets} className="px-2 sm:px-3">
          <Layers className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">60+ Presets</span>
          <span className="sm:hidden">Presets</span>
        </Button>

        <Button variant="outline" size="sm" onClick={onOpenIngest} className="px-2 sm:px-3">
          <Upload className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Import Spec</span>
          <span className="sm:hidden">Import</span>
        </Button>

        {onOpenSandbox && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenSandbox}
            className="px-2 sm:px-3 font-sans border-border hover:bg-muted"
            title="Open Fullscreen AI Sandbox"
          >
            <Bot className="h-3.5 w-3.5 sm:mr-1" />
            <span className="hidden sm:inline">AI Sandbox</span>
            <span className="sm:hidden">Sandbox</span>
          </Button>
        )}

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

        <a href="/docs" target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="px-2 sm:px-3 font-sans" title="PostMCP Documentation">
            <BookOpen className="h-3.5 w-3.5 sm:mr-1" />
            <span className="hidden sm:inline">Docs</span>
          </Button>
        </a>

        <ModeToggle />
      </div>
    </header>
  );
}
