'use client';

import * as React from 'react';
import { Terminal, CheckCircle2, Loader2, AlertCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';

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
  isOpen?: boolean;
  onToggle?: () => void;
}

export function ToolHeader({
  name,
  status = 'complete',
  badge = 'MCP Tool Call',
  isOpen = true,
  onToggle,
  className,
  children,
  ...props
}: ToolHeaderProps) {
  return (
    <div
      onClick={onToggle}
      className={cn(
        'flex items-center justify-between p-2.5 sm:p-3 bg-muted/40 border-b border-border cursor-pointer select-none text-foreground hover:bg-muted/60 transition-colors font-sans',
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Terminal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-semibold text-foreground truncate text-xs font-sans">{name}</span>
        <Badge variant="secondary" className="text-[9px] py-0 px-1 font-sans shrink-0">
          {badge}
        </Badge>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {status === 'running' && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
        {status === 'complete' && (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        )}
        {status === 'error' && (
          <AlertCircle className="h-3.5 w-3.5 text-destructive" />
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
  input: any;
}

export function ToolInput({ input, className, ...props }: ToolInputProps) {
  return (
    <div className={cn('space-y-1 font-sans', className)} {...props}>
      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block font-sans">
        Input Arguments
      </span>
      <pre className="p-2.5 bg-muted/30 border border-border rounded text-[11px] text-foreground overflow-x-auto font-sans">
        {typeof input === 'string' ? input : JSON.stringify(input, null, 2)}
      </pre>
    </div>
  );
}

export interface ToolOutputProps extends React.HTMLAttributes<HTMLDivElement> {
  output: any;
  savings?: number;
}

export function ToolOutput({ output, savings, className, ...props }: ToolOutputProps) {
  return (
    <div className={cn('space-y-1 pt-1 border-t border-border font-sans', className)} {...props}>
      <div className="flex items-center justify-between font-sans">
        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider font-sans">
          Output / Token Diet Payload
        </span>
        {savings !== undefined && (
          <span className="text-[10px] text-foreground bg-muted border border-border px-1.5 py-0.5 rounded font-sans">
            ~{savings}% Token Savings
          </span>
        )}
      </div>
      <pre className="p-2.5 bg-muted/30 border border-border rounded text-[11px] text-foreground overflow-x-auto whitespace-pre max-h-56 font-sans">
        {typeof output === 'string' ? output : JSON.stringify(output, null, 2)}
      </pre>
    </div>
  );
}
