'use client';

import * as React from 'react';
import { Terminal, CheckCircle2, Loader2, AlertCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';

export function getToolLabel(name: string): string {
  if (!name) return 'Tool Execution';
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export interface ToolProps extends React.HTMLAttributes<HTMLDivElement> {
  status?: 'running' | 'complete' | 'error';
}

export function Tool({ status = 'complete', className, children, ...props }: ToolProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card overflow-hidden font-sans text-xs transition-colors',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface ToolHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  status?: 'running' | 'complete' | 'error';
  badge?: string;
  savings?: number;
  isOpen?: boolean;
  onToggle?: () => void;
}

export function ToolHeader({
  name,
  status = 'complete',
  badge = 'MCP Tool Call',
  savings,
  isOpen = true,
  onToggle,
  className,
  children,
  ...props
}: ToolHeaderProps) {
  const displayLabel = getToolLabel(name);

  return (
    <div
      onClick={onToggle}
      className={cn(
        'flex items-center justify-between p-2.5 sm:p-3 bg-muted/40 border-b border-border cursor-pointer select-none text-foreground hover:bg-muted/60 transition-colors font-sans',
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2 min-w-0 flex-wrap">
        <Terminal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-semibold text-foreground truncate text-xs font-sans">
          {displayLabel}
        </span>
        <Badge variant="secondary" className="text-[9px] py-0 px-1.5 font-sans shrink-0">
          {name}
        </Badge>
        {savings !== undefined && (
          <Badge
            variant="outline"
            className="text-[9px] py-0 px-1 font-sans shrink-0 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
          >
            ~{savings}% Token Savings
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-2">
        {status === 'running' && (
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-sans">
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            <span className="hidden sm:inline">Executing...</span>
          </div>
        )}
        {status === 'complete' && (
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11px] font-sans">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Executed</span>
          </div>
        )}
        {status === 'error' && (
          <div className="flex items-center gap-1 text-destructive text-[11px] font-sans">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Failed</span>
          </div>
        )}
        {onToggle && (
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
              isOpen ? 'rotate-180' : 'rotate-0'
            )}
          />
        )}
      </div>
    </div>
  );
}

export interface ToolContentProps extends React.HTMLAttributes<HTMLDivElement> {
  isOpen?: boolean;
}

export function ToolContent({
  isOpen = true,
  className,
  children,
  ...props
}: ToolContentProps) {
  if (!isOpen) return null;

  return (
    <div className={cn('p-3 space-y-2.5 text-xs font-sans', className)} {...props}>
      {children}
    </div>
  );
}

export interface ToolInputProps extends React.HTMLAttributes<HTMLDivElement> {
  input: unknown;
}

export function ToolInput({ input, className, ...props }: ToolInputProps) {
  const hasProperties =
    input !== undefined &&
    input !== null &&
    (typeof input === 'string'
      ? input.trim().length > 0 && input.trim() !== '{}'
      : typeof input === 'object' && Object.keys(input).length > 0);

  const formatted =
    typeof input === 'string'
      ? input
      : input !== undefined && input !== null
      ? JSON.stringify(input, null, 2)
      : '';

  return (
    <div className={cn('space-y-1 font-sans', className)} {...props}>
      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block font-sans">
        Input Arguments
      </span>
      {hasProperties ? (
        <pre className="p-2.5 bg-muted/30 border border-border rounded text-[11px] text-foreground overflow-x-auto font-sans">
          {formatted}
        </pre>
      ) : (
        <div className="py-1 px-2.5 rounded bg-muted/20 border border-dashed border-border text-[11px] text-muted-foreground italic font-sans">
          No input parameters required for this operation
        </div>
      )}
    </div>
  );
}

export interface ToolOutputProps extends React.HTMLAttributes<HTMLDivElement> {
  output?: unknown;
  savings?: number;
  status?: 'running' | 'complete' | 'error';
}

export function ToolOutput({
  output,
  savings,
  status = 'complete',
  className,
  ...props
}: ToolOutputProps) {
  const isRunning = status === 'running';
  const hasOutput =
    output !== undefined &&
    output !== null &&
    (typeof output === 'string'
      ? output.trim().length > 0
      : typeof output === 'object' && Object.keys(output).length > 0);

  const formatted =
    typeof output === 'string'
      ? output
      : hasOutput
      ? JSON.stringify(output, null, 2)
      : '';

  return (
    <div className={cn('space-y-1 pt-1.5 border-t border-border font-sans', className)} {...props}>
      <div className="flex items-center justify-between font-sans">
        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider font-sans">
          Output / Token Diet Payload
        </span>
        {savings !== undefined && (
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-muted border border-border px-1.5 py-0.5 rounded font-sans">
            ~{savings}% Token Savings
          </span>
        )}
      </div>

      {isRunning && !hasOutput ? (
        <div className="flex items-center gap-2 py-2 px-2.5 rounded bg-muted/20 border border-dashed border-border text-[11px] text-muted-foreground font-sans animate-pulse">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
          <span>Executing operation and compiling Token Diet payload...</span>
        </div>
      ) : hasOutput ? (
        <pre className="p-2.5 bg-muted/30 border border-border rounded text-[11px] text-foreground overflow-x-auto whitespace-pre max-h-64 font-sans">
          {formatted}
        </pre>
      ) : (
        <div className="py-1 px-2.5 rounded bg-muted/20 border border-dashed border-border text-[11px] text-muted-foreground italic font-sans">
          Empty response payload returned from operation
        </div>
      )}
    </div>
  );
}
