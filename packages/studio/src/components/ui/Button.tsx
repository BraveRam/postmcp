import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export function Button({
  className,
  variant = 'default',
  size = 'md',
  disabled,
  children,
  ...props
}: ButtonProps) {
  const baseClasses =
    'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 select-none';

  const sizeClasses = {
    sm: 'h-8 px-3 text-xs gap-1.5',
    md: 'h-9 px-4 text-sm gap-2',
    lg: 'h-11 px-6 text-base gap-2.5',
    icon: 'h-9 w-9 p-0',
  };

  const variantClasses = {
    default: 'bg-blue-600 text-white hover:bg-blue-500 shadow-sm shadow-blue-950',
    secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700/60',
    outline: 'border border-slate-800 bg-transparent text-slate-300 hover:bg-slate-900 hover:text-white',
    ghost: 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50',
    destructive: 'bg-rose-600/20 text-rose-400 border border-rose-600/30 hover:bg-rose-600/30',
  };

  return (
    <button
      className={cn(baseClasses, sizeClasses[size], variantClasses[variant], className)}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
