import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { useStore } from '@/store';
import type { Toast } from '@/store/uiSlice';
import { cn } from '@/lib/utils';

const icons = {
  info: <Info className="w-4 h-4 text-accent-blue" />,
  success: <CheckCircle className="w-4 h-4 text-accent-green" />,
  warning: <AlertTriangle className="w-4 h-4 text-accent-amber" />,
  error: <AlertCircle className="w-4 h-4 text-accent-red" />,
  persistent: <Info className="w-4 h-4 text-accent-blue" />,
};

const colors = {
  info: 'border-accent-blue/30',
  success: 'border-accent-green/30',
  warning: 'border-accent-amber/30',
  error: 'border-accent-red/30',
  persistent: 'border-accent-blue/30',
};

function ToastItem({ toast }: { toast: Toast }) {
  const { removeToast } = useStore();

  useEffect(() => {
    if (toast.type === 'persistent') return;
    const t = setTimeout(() => removeToast(toast.id), 4000);
    return () => clearTimeout(t);
  }, [toast, removeToast]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={cn(
        'flex items-start gap-3 bg-bg-elevated border rounded-lg px-4 py-3 shadow-panel min-w-[280px] max-w-[360px]',
        colors[toast.type],
      )}
    >
      <span className="mt-0.5 flex-shrink-0">{icons[toast.type]}</span>
      <p className="text-sm text-text-primary flex-1 leading-snug">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className="ml-1 text-text-muted hover:text-text-primary transition-colors flex-shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

export function ToastContainer() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
