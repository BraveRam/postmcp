'use client';

import * as React from 'react';
import { Send, Square, Globe, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

export interface PromptInputMessage {
  text: string;
  files?: any[];
}

export interface PromptInputProps extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  onSubmit?: (message: PromptInputMessage, event?: React.FormEvent) => void;
}

export function PromptInput({
  onSubmit,
  className,
  children,
  ...props
}: PromptInputProps) {
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const textarea = form.querySelector('textarea') as HTMLTextAreaElement | null;
    const text = textarea ? textarea.value : '';
    if (onSubmit) {
      onSubmit({ text }, e);
    }
  };

  return (
    <form
      onSubmit={handleFormSubmit}
      className={cn(
        'relative rounded-xl border border-zinc-800 bg-zinc-950 p-2 shadow-2xl transition-colors focus-within:border-zinc-600',
        className
      )}
      {...props}
    >
      {children}
    </form>
  );
}

export interface PromptInputBodyProps extends React.HTMLAttributes<HTMLDivElement> {}

export function PromptInputBody({ className, children, ...props }: PromptInputBodyProps) {
  return (
    <div className={cn('relative flex flex-col', className)} {...props}>
      {children}
    </div>
  );
}

export interface PromptInputTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function PromptInputTextarea({
  className,
  rows = 2,
  ...props
}: PromptInputTextareaProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const form = textareaRef.current?.closest('form');
      if (form) {
        form.requestSubmit();
      }
    }
  };

  return (
    <textarea
      ref={textareaRef}
      rows={rows}
      onKeyDown={handleKeyDown}
      className={cn(
        'w-full resize-none bg-transparent px-3 py-2 text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 min-h-[50px] max-h-[160px]',
        className
      )}
      {...props}
    />
  );
}

export interface PromptInputFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export function PromptInputFooter({ className, children, ...props }: PromptInputFooterProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between border-t border-zinc-900 pt-2 px-1 text-xs',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface PromptInputToolsProps extends React.HTMLAttributes<HTMLDivElement> {}

export function PromptInputTools({ className, children, ...props }: PromptInputToolsProps) {
  return (
    <div className={cn('flex items-center gap-1.5', className)} {...props}>
      {children}
    </div>
  );
}

export interface PromptInputButtonProps extends React.ComponentProps<typeof Button> {
  tooltip?: string;
}

export function PromptInputButton({
  tooltip,
  className,
  children,
  ...props
}: PromptInputButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        'h-7 px-2 text-xs text-zinc-400 hover:text-white hover:bg-zinc-900 cursor-pointer font-mono',
        className
      )}
      title={tooltip}
      {...props}
    >
      {children}
    </Button>
  );
}

export interface PromptInputSubmitProps extends React.ComponentProps<typeof Button> {
  status?: 'submitted' | 'streaming' | 'ready' | 'error';
  onStop?: () => void;
}

export function PromptInputSubmit({
  status = 'ready',
  onStop,
  disabled,
  className,
  ...props
}: PromptInputSubmitProps) {
  const isStreaming = status === 'streaming' || status === 'submitted';

  if (isStreaming) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onStop}
        className={cn(
          'h-7 w-7 rounded-md border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800 cursor-pointer',
          className
        )}
        title="Stop generation"
        {...props}
      >
        <Square className="h-3 w-3 fill-white" />
      </Button>
    );
  }

  return (
    <Button
      type="submit"
      variant="default"
      size="icon"
      disabled={disabled}
      className={cn(
        'h-7 w-7 rounded-md bg-white text-black hover:bg-zinc-200 cursor-pointer disabled:opacity-40 shadow-xs',
        className
      )}
      title="Send prompt"
      {...props}
    >
      <Send className="h-3.5 w-3.5" />
    </Button>
  );
}
