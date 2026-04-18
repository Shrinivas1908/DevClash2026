import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow } from 'date-fns';

// Install clsx + tailwind-merge for cn()
// npm i clsx tailwind-merge
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function truncateSha(sha: string, n = 7): string {
  return sha.slice(0, n);
}

export function truncatePath(path: string, maxLen = 40): string {
  if (path.length <= maxLen) return path;
  const parts = path.split('/');
  const name = parts.pop() ?? '';
  return `…/${name}`;
}

export function formatRelativeTime(isoString: string): string {
  try {
    return formatDistanceToNow(new Date(isoString), { addSuffix: true });
  } catch {
    return isoString;
  }
}

export function getLanguageColor(lang: string): string {
  const map: Record<string, string> = {
    typescript: '#3178c6',
    javascript: '#f7df1e',
    python: '#3572A5',
    go: '#00ADD8',
    rust: '#dea584',
    java: '#b07219',
    css: '#563d7c',
    html: '#e34c26',
    json: '#292929',
    yaml: '#cb171e',
    markdown: '#083fa1',
    shell: '#89e051',
  };
  return map[lang.toLowerCase()] ?? '#8B91A8';
}

export function getImportanceBadgeClass(score: number): string {
  if (score >= 20) return 'bg-accent-red/20 text-accent-red border-accent-red/30';
  if (score >= 8) return 'bg-accent-amber/20 text-accent-amber border-accent-amber/30';
  return 'bg-accent-green/20 text-accent-green border-accent-green/30';
}

export function extractRepoName(url: string): string {
  const match = url.match(/github\.com\/([^/]+\/[^/]+)/);
  return match ? match[1] : url;
}

export function validateGithubUrl(url: string): boolean {
  return /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\/)?$/.test(url.trim());
}
