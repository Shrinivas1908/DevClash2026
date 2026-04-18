import { ApiError } from '@/types/api';

const BASE = () => import.meta.env.VITE_API_BASE_URL ?? '';

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE()}${path}`);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, text);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, text);
  }
  return res.json() as Promise<T>;
}

/**
 * Open an SSE stream for AI file summaries.
 * Returns a cleanup function to close the connection.
 */
export function streamSummary(
  id: string,
  onChunk: (text: string) => void,
  onError?: () => void,
): () => void {
  const es = new EventSource(`${BASE()}/api/files/${id}/summary`);
  es.onmessage = (e) => onChunk(e.data as string);
  es.onerror = () => {
    onError?.();
    es.close();
  };
  return () => es.close();
}


export { ApiError };
