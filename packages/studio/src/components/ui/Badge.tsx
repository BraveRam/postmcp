import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' | 'get' | 'post' | 'put' | 'delete' | 'patch';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variantClasses = {
    default: 'bg-primary text-primary-foreground font-semibold border-transparent shadow-xs',
    secondary: 'bg-secondary text-secondary-foreground border-border',
    outline: 'text-foreground border-border bg-transparent',
    success: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-medium',
    warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 font-medium',
    destructive: 'bg-destructive/15 text-destructive border-destructive/30 font-medium',
    get: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 font-bold uppercase',
    post: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-bold uppercase',
    put: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 font-bold uppercase',
    delete: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 font-bold uppercase',
    patch: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 font-bold uppercase',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-sans font-medium border transition-colors',
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
