'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Markdown } from '@/components/Markdown';

export interface MessageProps extends React.HTMLAttributes<HTMLDivElement> {
  from?: 'user' | 'assistant' | 'system';
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
        'group flex w-full font-sans text-xs animate-in fade-in-50 duration-200',
        isUser ? 'justify-end' : 'justify-start',
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'space-y-2 font-sans',
          isUser
            ? 'w-fit max-w-[50%] sm:max-w-[45%] ml-auto flex flex-col items-end'
            : 'w-full max-w-[92%] sm:max-w-[85%] items-start'
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
        'rounded-lg p-3 sm:p-4 text-xs font-sans leading-relaxed transition-all',
        from === 'user'
          ? 'w-fit max-w-full bg-secondary text-foreground ml-auto border border-border/30 shadow-none outline-none'
          : 'bg-muted/50 border border-border text-foreground mr-auto outline-none',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface MessageResponseProps extends React.HTMLAttributes<HTMLDivElement> {
  from?: 'user' | 'assistant' | 'system';
  children?: React.ReactNode;
}

export function MessageResponse({
  from = 'assistant',
  className,
  children,
  ...props
}: MessageResponseProps) {
  if (from !== 'user' && typeof children === 'string') {
    return (
      <div className={cn('font-sans text-xs leading-relaxed', className)} {...props}>
        <Markdown>{children}</Markdown>
      </div>
    );
  }

  return (
    <div className={cn('whitespace-pre-wrap font-sans text-xs leading-relaxed', className)} {...props}>
      {children}
    </div>
  );
}

export interface MessageActionsProps extends React.HTMLAttributes<HTMLDivElement> {}

export function MessageActions({ className, children, ...props }: MessageActionsProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 pt-1 text-muted-foreground opacity-80 group-hover:opacity-100 transition-opacity font-sans',
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
      className={cn('h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground font-sans', className)}
      title={tooltip || label}
      {...props}
    >
      {children}
      {label && <span className="ml-1 text-[11px] font-sans">{label}</span>}
    </Button>
  );
}
