import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { motion } from 'framer-motion';

interface ChartData {
  issue: string;
  count: number;
  latest_commit?: string;
}

export function IssueBarChart({ data }: { data: ChartData[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[400px] flex flex-col items-center justify-center border border-dashed border-border/50 rounded-2xl bg-bg-surface/30 backdrop-blur-sm">
        <div className="w-12 h-12 rounded-full bg-bg-elevated flex items-center justify-center mb-4 border border-border">
          <svg className="w-6 h-6 text-text-muted opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-text-muted">No velocity data available yet.</p>
        <p className="text-[10px] text-text-muted/60 mt-1">Complete commit analysis to see issue patterns.</p>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="h-[400px] w-full bg-bg-surface border border-border/50 rounded-2xl p-6 shadow-2xl relative overflow-hidden group"
    >
      {/* Background Glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-accent-blue/10 blur-[80px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-accent-purple/10 blur-[80px] rounded-full pointer-events-none" />

      <div className="flex items-center justify-between mb-8 relative z-10">
        <div className="space-y-1">
          <h3 className="text-xs font-black text-text-primary uppercase tracking-[0.2em]">Repository Velocity</h3>
          <p className="text-[10px] text-text-muted font-medium">Commit frequency and AI-identified theme hotspots</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-text-muted bg-bg-elevated/50 border border-border/50 px-2.5 py-1 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-blue shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            Commits
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-text-muted bg-bg-elevated/50 border border-border/50 px-2.5 py-1 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-purple shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
            AI Themes
          </span>
        </div>
      </div>
      
      <div className="h-[280px] w-full relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={data} 
            margin={{ top: 20, right: 10, left: -25, bottom: 40 }}
          >
            <defs>
              <linearGradient id="barGradientBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.8}/>
                <stop offset="100%" stopColor="#2563EB" stopOpacity={0.3}/>
              </linearGradient>
              <linearGradient id="barGradientPurple" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.3}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
            <XAxis 
              dataKey="issue" 
              axisLine={false}
              tickLine={false}
              interval={0}
              tick={({ x, y, payload }) => (
                <g transform={`translate(${x},${y})`}>
                  <text 
                    x={0} 
                    y={0} 
                    dy={16} 
                    textAnchor="end" 
                    fill="rgba(255,255,255,0.4)" 
                    fontSize={9} 
                    fontWeight={700}
                    transform="rotate(-35)"
                    className="font-mono"
                  >
                    {payload.value.length > 12 ? `${payload.value.substring(0, 10)}...` : payload.value}
                  </text>
                </g>
              )}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: 700 }}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              contentStyle={{ 
                backgroundColor: 'rgba(23, 23, 33, 0.95)', 
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '12px',
                fontSize: '11px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
                backdropFilter: 'blur(10px)',
                padding: '12px'
              }}
              itemStyle={{ color: '#E2E8F0', fontWeight: 'bold' }}
              labelStyle={{ color: '#3B82F6', marginBottom: '6px', fontWeight: '900', letterSpacing: '0.05em' }}
              formatter={(value: number) => [`${value} Activity Units`, 'Density']}
            />
            <Bar 
              dataKey="count" 
              radius={[6, 6, 0, 0]} 
              barSize={24}
              animationDuration={1500}
              animationBegin={200}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={index % 2 === 0 ? 'url(#barGradientBlue)' : 'url(#barGradientPurple)'} 
                  stroke={index % 2 === 0 ? '#3B82F6' : '#8B5CF6'}
                  strokeWidth={1}
                  strokeOpacity={0.3}
                />
              ))}
              <LabelList 
                dataKey="count" 
                position="top" 
                fill="rgba(255,255,255,0.4)" 
                fontSize={9} 
                fontWeight="bold"
                offset={10}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
