import fs from 'fs';

const PREVIEW_LINES = 80;

/**
 * Compute the onboarding path — ordered list of up to 20 files a new developer should read.
 * Priority: entry points → task-keyword matches → high importance files
 */
export function computeOnboardingPath(analyzedFiles, taskDescription, summariesMap) {
  const taskKeywords = taskDescription
    ? taskDescription.toLowerCase().split(/\W+/).filter((w) => w.length > 3)
    : [];

  const scored = analyzedFiles.map((f) => {
    let score = f.importance || 0;

    // Boost entry points
    if (f.is_entry_point) score += 50;

    // Boost task keyword matches in path or summary
    const summary = summariesMap.get ? summariesMap.get(f.path) : (summariesMap[f.path] || '');
    const haystack = (f.path + ' ' + (typeof summary === 'string' ? summary : (summary?.summary || ''))).toLowerCase();
    
    for (const kw of taskKeywords) {
      if (haystack.includes(kw)) score += 10;
    }

    return { path: f.path, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map((f) => f.path);
}
