'use client';

import * as React from 'react';
import { ArrowDown, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

export interface ConversationProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Conversation({ className, children, ...props }: ConversationProps) {
  return (
    <div
      className={cn('relative flex-1 flex flex-col h-full overflow-hidden w-full', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export interface ConversationContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export function ConversationContent({ className, children, ...props }: ConversationContentProps) {
  return (
    <div
      className={cn(
        'flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 scroll-smooth',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface ConversationEmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}

export function ConversationEmptyState({
  title = 'Start a conversation',
  description = 'Send a message to begin chatting with the MCP agent.',
  icon = <MessageSquare className="h-8 w-8 text-zinc-500" />,
  className,
  children,
  ...props
}: ConversationEmptyStateProps) {
  return (
    <div
      className={cn(
        'h-full min-h-[260px] flex flex-col items-center justify-center text-center p-6 space-y-3 font-mono',
        className
      )}
      {...props}
    >
      <div className="h-14 w-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white">
        {icon}
      </div>
      <div className="space-y-1 max-w-sm">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="text-xs text-zinc-400 leading-relaxed">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function ConversationScrollButton({
  onClick,
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onClick}
      className={cn(
        'absolute bottom-3 right-4 h-8 w-8 rounded-full bg-zinc-900/90 border-zinc-700 text-white shadow-lg backdrop-blur hover:bg-zinc-800',
        className
      )}
      {...props}
    >
      <ArrowDown className="h-4 w-4" />
      <span className="sr-only">Scroll to bottom</span>
    </Button>
  );
}
