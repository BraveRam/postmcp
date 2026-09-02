'use client';

import * as React from 'react';
import { Bot, User, Copy, Check, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

export interface MessageProps extends React.HTMLAttributes<HTMLDivElement> {
  from?: 'user' | 'assistant' | 'system';
  avatar?: React.ReactNode;
}

export function Message({
  from = 'assistant',
  avatar,
  className,
  children,
  ...props
}: MessageProps) {
  const isUser = from === 'user';

  return (
    <div
      className={cn(
        'group flex gap-3 sm:gap-4 text-xs font-sans animate-in fade-in-50 duration-200',
        isUser ? 'justify-end' : 'justify-start',
        className
      )}
      {...props}
    >
      {!isUser && (
        <div className="h-7 w-7 rounded bg-white text-black flex items-center justify-center shrink-0 font-bold shadow-xs">
          {avatar || <Bot className="h-4 w-4" />}
        </div>
      )}

      <div
        className={cn(
          'max-w-[90%] sm:max-w-[80%] space-y-2.5',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        {children}
      </div>

      {isUser && (
        <div className="h-7 w-7 rounded bg-zinc-900 border border-zinc-700 text-white flex items-center justify-center shrink-0 shadow-xs">
          {avatar || <User className="h-4 w-4" />}
        </div>
      )}
    </div>
  );
}

export interface MessageContentProps extends React.HTMLAttributes<HTMLDivElement> {
  from?: 'user' | 'assistant' | 'system';
}

export function MessageContent({
  from,
  className,
  children,
  ...props
}: MessageContentProps) {
  return (
    <div
      className={cn(
        'rounded-lg p-3.5 sm:p-4 text-xs leading-relaxed transition-all',
        from === 'user'
          ? 'bg-zinc-900 border border-zinc-700 text-white'
          : 'bg-zinc-950 border border-zinc-800 text-zinc-200',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface MessageResponseProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function MessageResponse({
  className,
  children,
  ...props
}: MessageResponseProps) {
  return (
    <div className={cn('whitespace-pre-wrap font-sans text-xs', className)} {...props}>
      {children}
    </div>
  );
}

export interface MessageActionsProps extends React.HTMLAttributes<HTMLDivElement> {}

export function MessageActions({ className, children, ...props }: MessageActionsProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 pt-1 text-zinc-500 opacity-80 group-hover:opacity-100 transition-opacity',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface MessageActionProps extends React.ComponentProps<typeof Button> {
  label?: string;
  tooltip?: string;
}

export function MessageAction({
  label,
  tooltip,
  className,
  children,
  ...props
}: MessageActionProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn('h-6 px-2 text-[11px] text-zinc-400 hover:text-white hover:bg-zinc-900', className)}
      title={tooltip || label}
      {...props}
    >
      {children}
      {label && <span className="ml-1 text-[11px] font-mono">{label}</span>}
    </Button>
  );
}
