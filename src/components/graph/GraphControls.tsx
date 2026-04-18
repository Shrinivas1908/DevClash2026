import { useReactFlow } from '@xyflow/react';
import { ZoomIn, ZoomOut, Maximize2, Tag, Minimize, LayoutTemplate } from 'lucide-react';
import { useStore } from '@/store';
import type { LayoutType } from '@/store/graphSlice';
import { cn } from '@/lib/utils';

const LAYOUTS: { key: LayoutType; label: string }[] = [
  { key: 'dagre-v', label: 'Vertical' },
  { key: 'dagre-h', label: 'Horizontal' },
];

export function GraphControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { layout, setLayout, compactMode, setCompactMode } = useStore();

  return (
    <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
      {/* Zoom controls */}
      <div className="flex flex-col bg-bg-surface border border-border rounded-lg overflow-hidden shadow-panel">
        <button
          onClick={() => zoomIn({ duration: 200 })}
          className="p-2.5 hover:bg-bg-hover transition-colors border-b border-border"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-4 h-4 text-text-secondary" />
        </button>
        <button
          onClick={() => zoomOut({ duration: 200 })}
          className="p-2.5 hover:bg-bg-hover transition-colors border-b border-border"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-4 h-4 text-text-secondary" />
        </button>
        <button
          onClick={() => fitView({ duration: 300, padding: 0.1 })}
          className="p-2.5 hover:bg-bg-hover transition-colors"
          aria-label="Fit view"
        >
          <Maximize2 className="w-4 h-4 text-text-secondary" />
        </button>
      </div>

      {/* Toggle controls */}
      <div className="flex flex-col bg-bg-surface border border-border rounded-lg overflow-hidden shadow-panel">
        <button
          onClick={() => setCompactMode(!compactMode)}
          className={cn('p-2.5 hover:bg-bg-hover transition-colors border-b border-border', compactMode && 'text-accent-blue bg-accent-blue/10')}
          title={compactMode ? 'Expand labels' : 'Compact mode'}
        >
          {compactMode ? <Tag className="w-4 h-4" /> : <Minimize className="w-4 h-4 text-text-secondary" />}
        </button>
        <button
          title="Switch layout direction"
          onClick={() => setLayout(layout === 'dagre-v' ? 'dagre-h' : 'dagre-v')}
          className="p-2.5 hover:bg-bg-hover transition-colors"
        >
          <LayoutTemplate className="w-4 h-4 text-text-secondary" />
        </button>
      </div>

      {/* Layout label */}
      <div className="bg-bg-surface border border-border rounded-lg px-2.5 py-1.5 text-center">
        <p className="text-[10px] text-text-muted">
          {LAYOUTS.find((l) => l.key === layout)?.label}
        </p>
      </div>
    </div>
  );
}
