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
    'inline-flex items-center justify-center rounded-md font-sans font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-40 select-none cursor-pointer';

  const sizeClasses = {
    sm: 'h-8 px-2.5 text-xs gap-1.5',
    md: 'h-9 px-3.5 text-sm gap-2',
    lg: 'h-10 px-5 text-sm gap-2.5',
    icon: 'h-8 w-8 p-0',
  };

  const variantClasses = {
    default: 'bg-white text-black hover:bg-zinc-200 font-semibold shadow-sm',
    secondary: 'bg-zinc-900 text-zinc-100 hover:bg-zinc-800 border border-zinc-800',
    outline: 'border border-zinc-800 bg-transparent text-zinc-300 hover:bg-zinc-900 hover:text-white',
    ghost: 'text-zinc-400 hover:text-white hover:bg-zinc-900',
    destructive: 'bg-zinc-900 text-zinc-200 border border-zinc-700 hover:bg-zinc-800',
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
