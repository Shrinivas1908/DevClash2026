import { Info } from 'lucide-react';

const ENTRIES = [
  { color: 'bg-accent-red', label: 'High Importance', desc: 'Critical logic, critical dependencies (Score ≥ 20)' },
  { color: 'bg-accent-amber', label: 'Medium Importance', desc: 'Core modules and business logic (Score 8-19)' },
  { color: 'bg-accent-green', label: 'Low Importance', desc: 'Utility functions and leaf nodes (Score < 8)' },
  { color: 'bg-accent-blue shadow-[0_0_8px_rgba(77,142,247,0.5)]', label: 'Entry Point', desc: 'Main entry files (e.g., main.ts, server.ts)' },
];

export function GraphLegend() {
  return (
    <div className="absolute bottom-4 left-4 z-10 bg-bg-surface/80 backdrop-blur-md border border-border rounded-xl p-3 shadow-panel max-w-[240px] pointer-events-none sm:pointer-events-auto group">
      <div className="flex items-center gap-2 mb-2 text-text-muted">
        <Info className="w-3.5 h-3.5" />
        <span className="text-[10px] font-bold uppercase tracking-wider">Graph Legend</span>
      </div>
      <div className="space-y-2.5">
        {ENTRIES.map((entry) => (
          <div key={entry.label} className="flex gap-2">
            <div className={`w-3 h-3 rounded-full mt-0.5 flex-shrink-0 ${entry.color}`} />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-text-primary leading-none">{entry.label}</p>
              <p className="text-[9px] text-text-muted leading-tight mt-0.5">{entry.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
