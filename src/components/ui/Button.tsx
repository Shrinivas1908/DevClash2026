import React from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './Spinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, icon, children, className, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base disabled:opacity-50 disabled:cursor-not-allowed select-none';

    const variants = {
      primary:
        'bg-accent-blue text-white hover:bg-blue-500 active:scale-[0.98] shadow-md hover:shadow-glow',
      secondary:
        'bg-bg-elevated text-text-primary border border-border hover:bg-bg-hover',
      ghost:
        'bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-hover',
      danger:
        'bg-accent-red/10 text-accent-red border border-accent-red/30 hover:bg-accent-red/20',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs h-7',
      md: 'px-4 py-2 text-sm h-9',
      lg: 'px-6 py-3 text-base h-11',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading ? <Spinner size="sm" /> : icon}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
