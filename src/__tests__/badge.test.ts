import { describe, it, expect } from 'vitest';
import { importanceBadge } from '@/components/ui/Badge';

describe('Badge — importanceBadge color mapping', () => {
  it('returns red for high importance (>=20)', () => {
    expect(importanceBadge(20)).toBe('red');
    expect(importanceBadge(28)).toBe('red');
    expect(importanceBadge(100)).toBe('red');
  });

  it('returns amber for medium importance (8-19)', () => {
    expect(importanceBadge(8)).toBe('amber');
    expect(importanceBadge(15)).toBe('amber');
    expect(importanceBadge(19)).toBe('amber');
  });

  it('returns green for low importance (<8)', () => {
    expect(importanceBadge(0)).toBe('green');
    expect(importanceBadge(5)).toBe('green');
    expect(importanceBadge(7)).toBe('green');
  });
});
