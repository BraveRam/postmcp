import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' | 'get' | 'post' | 'put' | 'delete' | 'patch';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variantClasses = {
    default: 'bg-white text-black font-semibold border-white shadow-xs',
    secondary: 'bg-zinc-900 text-zinc-300 border-zinc-800',
    outline: 'text-zinc-400 border-zinc-800 bg-transparent',
    success: 'bg-zinc-900 text-zinc-200 border-zinc-700 font-medium',
    warning: 'bg-zinc-800 text-zinc-200 border-zinc-600 font-medium',
    destructive: 'bg-zinc-950 text-zinc-400 border-zinc-800 font-medium',
    get: 'bg-zinc-900 text-zinc-100 border-zinc-700 font-bold uppercase',
    post: 'bg-white text-black border-white font-bold uppercase',
    put: 'bg-zinc-800 text-zinc-100 border-zinc-600 font-bold uppercase',
    delete: 'bg-zinc-950 text-zinc-400 border-zinc-800 font-bold uppercase',
    patch: 'bg-zinc-800 text-zinc-200 border-zinc-600 font-bold uppercase',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-mono font-medium border transition-colors',
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
