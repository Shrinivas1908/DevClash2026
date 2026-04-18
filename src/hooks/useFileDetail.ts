import { useState, useEffect, useRef } from 'react';
import { streamSummary } from '@/lib/api';
import { IS_MOCK_MODE, MOCK_AI_SUMMARY } from '@/lib/mockData';

export type SummaryStatus = 'idle' | 'streaming' | 'complete' | 'error' | 'unavailable';

export function useFileDetail(id: string | null) {
  const [summary, setSummary] = useState('');
  const [status, setStatus] = useState<SummaryStatus>('idle');
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!id) {
      setSummary('');
      setStatus('idle');
      return;
    }

    // Clean up previous stream
    cleanupRef.current?.();
    setSummary('');
    setStatus('streaming');

    if (IS_MOCK_MODE) {
      // ... same mock logic ...
      let cancelled = false;
      const chars = MOCK_AI_SUMMARY.split('');
      let i = 0;
      const tick = () => {
        if (cancelled) return;
        const chunk = chars.slice(i, i + 8).join('');
        if (!chunk) { setStatus('complete'); return; }
        setSummary((prev) => prev + chunk);
        i += 8;
        setTimeout(tick, 30);
      };
      tick();
      cleanupRef.current = () => { cancelled = true; };
      return;
    }

    const cleanup = streamSummary(
      id,
      (chunk) => {
        setSummary((prev) => prev + chunk);
        setStatus('streaming');
      },
      () => setStatus('unavailable'),
    );
    cleanupRef.current = cleanup;

    return () => cleanup();
  }, [id]);


  return { summary, status };
}
