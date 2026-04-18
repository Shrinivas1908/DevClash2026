import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const offset = 8;
    if (side === 'top') setPos({ top: rect.top - offset, left: rect.left + rect.width / 2 });
    if (side === 'bottom') setPos({ top: rect.bottom + offset, left: rect.left + rect.width / 2 });
    if (side === 'left') setPos({ top: rect.top + rect.height / 2, left: rect.left - offset });
    if (side === 'right') setPos({ top: rect.top + rect.height / 2, left: rect.right + offset });
  }, [visible, side]);

  const child = React.cloneElement(children, {
    ref: triggerRef,
    onMouseEnter: () => setVisible(true),
    onMouseLeave: () => setVisible(false),
  } as React.HTMLAttributes<HTMLElement>);

  const translateClass = {
    top: '-translate-x-1/2 -translate-y-full',
    bottom: '-translate-x-1/2',
    left: '-translate-y-1/2 -translate-x-full',
    right: '-translate-y-1/2',
  }[side];

  return (
    <>
      {child}
      {visible &&
        createPortal(
          <div
            ref={tooltipRef}
            style={{ top: pos.top, left: pos.left, position: 'fixed', zIndex: 9999 }}
            className={cn(
              'pointer-events-none transform',
              translateClass,
              'bg-bg-elevated border border-border rounded-lg px-3 py-2 text-xs text-text-primary shadow-panel max-w-[240px]',
              'animate-fade-in-up',
              className,
            )}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
