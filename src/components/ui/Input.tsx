import React from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ icon, iconRight, error, className, ...props }, ref) => (
    <div className="relative w-full">
      {icon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
          {icon}
        </span>
      )}
      <input
        ref={ref}
        className={cn(
          'w-full bg-bg-elevated border border-border rounded-lg text-text-primary placeholder-text-muted',
          'transition-all duration-200 outline-none',
          'focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20',
          'hover:border-border',
          icon ? 'pl-9' : 'pl-3',
          iconRight ? 'pr-9' : 'pr-3',
          'py-2 text-sm',
          error && 'border-accent-red focus:border-accent-red focus:ring-accent-red/20',
          className,
        )}
        {...props}
      />
      {iconRight && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
          {iconRight}
        </span>
      )}
      {error && <p className="mt-1 text-xs text-accent-red">{error}</p>}
    </div>
  ),
);

Input.displayName = 'Input';
