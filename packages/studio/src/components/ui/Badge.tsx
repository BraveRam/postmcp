import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' | 'get' | 'post' | 'put' | 'delete' | 'patch';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variantClasses = {
    default: 'bg-blue-600/20 text-blue-400 border-blue-500/30',
    secondary: 'bg-slate-800 text-slate-300 border-slate-700',
    outline: 'text-slate-400 border-slate-800',
    success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    destructive: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    get: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60',
    post: 'bg-blue-950/60 text-blue-400 border-blue-800/60',
    put: 'bg-amber-950/60 text-amber-400 border-amber-800/60',
    delete: 'bg-rose-950/60 text-rose-400 border-rose-800/60',
    patch: 'bg-purple-950/60 text-purple-400 border-purple-800/60',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-mono font-medium transition-colors',
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
