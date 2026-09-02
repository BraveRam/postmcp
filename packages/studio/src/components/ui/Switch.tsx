import React from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
}

export function Switch({ checked, onChange, disabled, className, label }: SwitchProps) {
  return (
    <label className={cn('inline-flex items-center gap-2 cursor-pointer select-none font-sans', disabled && 'opacity-40 cursor-not-allowed', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400',
          checked ? 'bg-white' : 'bg-zinc-800'
        )}
      >
        <span
          className={cn(
            'pointer-events-none block h-4 w-4 rounded-full shadow-sm transition-transform',
            checked ? 'bg-black translate-x-4' : 'bg-zinc-400 translate-x-0'
          )}
        />
      </button>
      {label && <span className="text-xs font-sans font-medium text-zinc-300">{label}</span>}
    </label>
  );
}
