import { describe, it, expect } from 'vitest';
import { validateGithubUrl } from '@/lib/utils';

describe('LandingPage — GitHub URL validation', () => {
  it('accepts valid github URLs', () => {
    expect(validateGithubUrl('https://github.com/facebook/react')).toBe(true);
    expect(validateGithubUrl('https://github.com/owner/my-repo')).toBe(true);
    expect(validateGithubUrl('https://github.com/o123/repo.name')).toBe(true);
    expect(validateGithubUrl('https://github.com/owner/repo/')).toBe(true);
  });

  it('rejects invalid github URLs', () => {
    expect(validateGithubUrl('http://github.com/owner/repo')).toBe(false);
    expect(validateGithubUrl('https://gitlab.com/owner/repo')).toBe(false);
    expect(validateGithubUrl('https://github.com/owner')).toBe(false);
    expect(validateGithubUrl('not-a-url')).toBe(false);
    expect(validateGithubUrl('')).toBe(false);
    expect(validateGithubUrl('https://github.com/')).toBe(false);
  });

  it('rejects URLs with extra path segments', () => {
    // Only owner/repo — no sub-paths
    expect(validateGithubUrl('https://github.com/owner/repo/blob/main/file.ts')).toBe(false);
  });
});
