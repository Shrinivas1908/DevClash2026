const fs = require('fs');
const { generateFileSummaries } = require('../../services/gemini');

const BATCH_SIZE = 20; // files per Gemini request
const PREVIEW_LINES = 80; // max lines to send per file

/**
 * Stage 4: Generate AI summaries for all analyzed files using Gemini 1.5 Flash.
 * Caches by (repoId, filePath, commitSha) — never re-summarises unchanged files.
 *
 * @param {Array} analyzedFiles
 * @param {string} commitSha
 * @param {Map<string,string>} existingSummaries - path -> existing summary from cache
 * @param {function} onProgress - callback(percent, message)
 * @returns {Promise<Map<string, string>>} path -> summary
 */
async function runAiSummaries(analyzedFiles, commitSha, existingSummaries, onProgress) {
  onProgress(65, 'Preparing AI summaries…');

  const summaries = new Map(existingSummaries); // start with cached summaries

  // Only process files that don't already have a summary cached
  const filesToProcess = analyzedFiles.filter((f) => !summaries.has(f.path));

  if (filesToProcess.length === 0) {
    onProgress(90, 'All summaries loaded from cache');
    return summaries;
  }

  // Sort by importance descending — summarise most important files first
  const sortedFiles = [...filesToProcess].sort((a, b) => (b.importance || 0) - (a.importance || 0));

  const totalBatches = Math.ceil(sortedFiles.length / BATCH_SIZE);
  let processedBatches = 0;

  const batchPromises = [];
  for (let i = 0; i < sortedFiles.length; i += BATCH_SIZE) {
    const batch = sortedFiles.slice(i, i + BATCH_SIZE);

    const promise = (async () => {
      // Prepare batch payload
      const batchPayload = batch.map((f) => ({
        path: f.path,
        language: f.language || 'unknown',
        content: readFilePreview(f.absolutePath),
        imports: (f.imports || []).slice(0, 15),
        exports: (f.exports || []).slice(0, 15),
      }));

      // Call Gemini (includes built-in queueing rate limit)
      const batchResults = await generateFileSummaries(batchPayload);

      // Merge into summaries map
      for (const [filePath, summary] of batchResults.entries()) {
        summaries.set(filePath, summary);
      }

      processedBatches++;
      const percent = 65 + Math.floor((processedBatches / totalBatches) * 25);
      onProgress(
        Math.min(percent, 90),
        `AI summaries: ${processedBatches}/${totalBatches} batches done`
      );
    })();

    batchPromises.push(promise);
    
    // Optional: add a tiny delay between starting promises to avoid huge bursts
    await new Promise(r => setTimeout(r, 100));
  }

  await Promise.all(batchPromises);


  onProgress(90, `Generated ${summaries.size} file summaries`);
  return summaries;
}

/**
 * Read first N lines of a file for the AI prompt preview.
 */
function readFilePreview(absolutePath) {
  if (!absolutePath) return '';
  try {
    const content = fs.readFileSync(absolutePath, 'utf8');
    return content.split('\n').slice(0, PREVIEW_LINES).join('\n');
  } catch {
    return '';
  }
}

/**
 * Compute the onboarding path — ordered list of up to 20 files a new developer should read.
 * Priority: entry points → task-keyword matches → high importance files
 *
 * @param {Array} analyzedFiles
 * @param {string} taskDescription
 * @param {Map<string, string>} summaries
 * @returns {Array<string>} ordered file paths
 */
function computeOnboardingPath(analyzedFiles, taskDescription, summaries) {
  const taskKeywords = taskDescription
    ? taskDescription.toLowerCase().split(/\W+/).filter((w) => w.length > 3)
    : [];

  const scored = analyzedFiles.map((f) => {
    let score = f.importance || 0;

    // Boost entry points
    if (f.is_entry_point) score += 50;

    // Boost task keyword matches in path or summary
    const haystack = (f.path + ' ' + (summaries.get(f.path) || '')).toLowerCase();
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

module.exports = { runAiSummaries, computeOnboardingPath };
