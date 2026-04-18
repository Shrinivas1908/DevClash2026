import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError } from '@/types/api';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Must mock import.meta.env BEFORE importing api
vi.stubGlobal('import', { meta: { env: { VITE_API_BASE_URL: 'https://api.test' } } });

// Dynamic import to ensure env stub takes effect
const { apiGet, apiPost } = await import('@/lib/api');

describe('api.ts', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('apiGet returns parsed JSON on 200', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: 'ok' }),
    });
    const result = await apiGet('/test');
    expect(result).toEqual({ data: 'ok' });
  });

  it('apiPost throws ApiError on 4xx', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: () => Promise.resolve('Unprocessable Entity'),
    });
    await expect(apiPost('/test', {})).rejects.toBeInstanceOf(ApiError);
  });

  it('apiPost throws ApiError with correct status code', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    });
    try {
      await apiPost('/test', {});
    } catch (e) {
      expect((e as ApiError).status).toBe(500);
    }
  });

  it('apiGet throws ApiError on 5xx', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: () => Promise.resolve('Service Unavailable'),
    });
    await expect(apiGet('/test')).rejects.toBeInstanceOf(ApiError);
  });
});
