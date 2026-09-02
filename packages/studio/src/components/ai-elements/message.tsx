'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

export interface MessageProps extends React.HTMLAttributes<HTMLDivElement> {
  from?: 'user' | 'assistant' | 'system';
  avatar?: React.ReactNode;
}

export function Message({
  from = 'assistant',
  className,
  children,
  ...props
}: MessageProps) {
  const isUser = from === 'user';

  return (
    <div
      className={cn(
        'group flex w-full font-mono text-xs animate-in fade-in-50 duration-200',
        isUser ? 'justify-end' : 'justify-start',
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'w-full max-w-[92%] sm:max-w-[85%] space-y-2',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        {children}
      </div>
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
        'rounded-lg p-3 sm:p-4 text-xs font-mono leading-relaxed transition-all',
        from === 'user'
          ? 'bg-zinc-900 border border-zinc-700 text-white ml-auto'
          : 'bg-zinc-950 border border-zinc-800 text-zinc-200 mr-auto',
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
    <div className={cn('whitespace-pre-wrap font-mono text-xs leading-relaxed', className)} {...props}>
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
      className={cn('h-6 px-2 text-[11px] text-zinc-400 hover:text-white hover:bg-zinc-900 font-mono', className)}
      title={tooltip || label}
      {...props}
    >
      {children}
      {label && <span className="ml-1 text-[11px] font-mono">{label}</span>}
    </Button>
  );
}
