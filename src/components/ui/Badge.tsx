import React from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'muted' | 'default';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

const variants: Record<BadgeVariant, string> = {
  blue: 'bg-accent-blue/15 text-accent-blue border-accent-blue/25',
  green: 'bg-accent-green/15 text-accent-green border-accent-green/25',
  amber: 'bg-accent-amber/15 text-accent-amber border-accent-amber/25',
  red: 'bg-accent-red/15 text-accent-red border-accent-red/25',
  purple: 'bg-accent-purple/15 text-accent-purple border-accent-purple/25',
  muted: 'bg-bg-elevated text-text-muted border-border',
  default: 'bg-bg-hover text-text-secondary border-border',
};

export function Badge({ variant = 'default', children, className, dot }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border',
        variants[variant],
        className,
      )}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', `bg-current`)} />}
      {children}
    </span>
  );
}

export function importanceBadge(score: number): BadgeVariant {
  if (score >= 20) return 'red';
  if (score >= 8) return 'amber';
  return 'green';
}
