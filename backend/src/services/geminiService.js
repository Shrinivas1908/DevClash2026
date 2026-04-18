/**
 * services/geminiService.js — Production-ready Gemini 2.0 Flash service.
 */

import logger from '../utils/logger.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.0-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is missing from environment variables");
}

/**
 * Simple Rate Limiter to handle 12 req/min and 5s batch spacing.
 */
class RateLimiter {
  constructor(maxRequestsPerMinute = 20, minIntervalMs = 5000) {
    this.maxRequestsPerMinute = maxRequestsPerMinute;
    this.minIntervalMs = minIntervalMs;
    this.lastRequestTime = 0;
    this.requestCount = 0;
    this.windowStart = Date.now();
  }

  async throttle() {
    const now = Date.now();

    // Reset window every minute
    if (now - this.windowStart > 60000) {
      this.windowStart = now;
      this.requestCount = 0;
    }

    // Check if we hit the minute cap
    if (this.requestCount >= this.maxRequestsPerMinute) {
      const waitTime = 60000 - (now - this.windowStart);
      logger.info(`Rate limit reached. Waiting ${waitTime}ms for next window.`);
      await new Promise(r => setTimeout(r, waitTime));
      return this.throttle(); // Re-check
    }

    // Ensure min interval between requests (e.g. for batching)
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minIntervalMs) {
      const waitTime = this.minIntervalMs - elapsed;
      await new Promise(r => setTimeout(r, waitTime));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }
}

const limiter = new RateLimiter();

/**
 * Retry wrapper with exponential backoff.
 * @template T
 * @param {() => Promise<T>} fn
 * @param {number} maxAttempts
 * @returns {Promise<T>}
 */
async function withRetry(fn, maxAttempts = 3) {
  let attempt = 1;
  while (attempt <= maxAttempts) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable = err.status === 429 || err.status === 503 || err.status >= 500;
      if (attempt === maxAttempts || !isRetryable) {
        throw err;
      }
      const backoff = Math.pow(2, attempt - 1) * 1000;
      logger.warn(`Gemini attempt ${attempt} failed: ${err.message}. Retrying in ${backoff}ms...`);
      await new Promise(r => setTimeout(r, backoff));
      attempt++;
    }
  }
}

/**
 * Core Gemini API call.
 * @param {string} prompt 
 * @returns {Promise<string>}
 */
async function callGemini(prompt) {
  await limiter.throttle();

  return withRetry(async () => {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 2048, temperature: 0.2 }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      logger.error(`Gemini API Error: ${response.status}`, JSON.stringify(data, null, 2));
      const error = new Error(`Gemini API returned ${response.status}`);
      error.status = response.status;
      throw error;
    }

    try {
      return data.candidates[0].content.parts[0].text;
    } catch (err) {
      logger.error("Failed to parse Gemini response structure", JSON.stringify(data, null, 2));
      throw new Error("Malformed Gemini response");
    }
  });
}

/**
 * Generate a high-level architectural context for the repository.
 * 
 * @param {Object} repo - Repo metadata
 * @param {Array} topFiles - Important file names/paths
 * @param {Array} entryPoints - Entry point file paths
 * @returns {Promise<string>} Plain-English description (~200 tokens)
 */
export async function generateRepoContext(repo, topFiles, entryPoints) {
  logger.info(`Generating repo context for ${repo.repo_name}`);

  const prompt = `Analyze this repository metadata and provide a high-level architectural description (approx 200 tokens).
Identify the core purpose, primary entry points, key modules, and overall technology stack.

REPO: ${repo.repo_name}
URL: ${repo.repo_url}
ENTRY POINTS: ${entryPoints.join(', ')}
KEY FILES: ${topFiles.map(f => f.path).join(', ')}
LANGUAGES: ${JSON.stringify(repo.language_stats)}

Respond with a plain-English summary.`;

  try {
    return await callGemini(prompt);
  } catch (err) {
    logger.error("generateRepoContext failed", err.message);
    return "A complex software project with multiple interconnected components.";
  }
}

/**
 * Generate a summary for a single file on-demand.
 * 
 * @param {Object} file - File metadata and content
 * @param {string} contextSummary - Repository-level context
 * @returns {Promise<Object>} { summary, role, issues[] }
 */
export async function generateFileSummary(file, contextSummary) {
  const prompt = `[CONTEXT]
${contextSummary}

[TASK]
Analyze the following file and provide:
1. SUMMARY: 1-2 sentence technical summary.
2. ROLE: Its specific role in the architecture (e.g. Middleware, Data Model, API Route).
3. ISSUES: A list of potential technical debt or complexity hotspots (comma-separated).

FILE: ${file.file_path}
CODE:
${file.content.slice(0, 5000)}

Respond strictly in this format:
SUMMARY: <text>
ROLE: <text>
ISSUES: <text1>, <text2>`;

  try {
    const text = await callGemini(prompt);
    return parseGeminiOutput(text);
  } catch (err) {
    logger.error(`generateFileSummary failed for ${file.file_path}`, err.message);
    return { summary: "Unavailable", role: "unknown", issues: [] };
  }
}

/**
 * Generate summaries for a batch of files.
 * 
 * @param {Array} files - List of file objects
 * @param {string} contextSummary - Repository-level context
 * @returns {Promise<Map<string, Object>>} Map of filePath -> result
 */
export async function generateFileSummariesBatch(files, contextSummary) {
  logger.info(`Batch processing ${files.length} files...`);
  const results = new Map();
  const BATCH_SIZE = 20;

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);

    const fileBlocks = batch.map((f, idx) => `
FILE:${idx + 1}
PATH:${f.path}
CODE:
${f.content.slice(0, 2000)}
`).join('\n---\n');

    const prompt = `[CONTEXT]
${contextSummary}

[TASK]
Analyze the following ${batch.length} files. For each file, provide:
1. SUMMARY: 1-2 sentence technical summary.
2. ROLE: Its specific role in the architecture.
3. ISSUES: Technical debt or complexity (comma-separated).

Respond for each file using markers FILE:N SUMMARY: ROLE: ISSUES:

FILES:
${fileBlocks}`;

    try {
      const text = await callGemini(prompt);

      // Parse multi-file response
      const fileMatches = text.split(/FILE:\d+/).filter(Boolean);
      batch.forEach((f, idx) => {
        if (fileMatches[idx]) {
          results.set(f.path, parseGeminiOutput(fileMatches[idx]));
        } else {
          results.set(f.path, { summary: "Unavailable", role: "unknown", issues: [] });
        }
      });
    } catch (err) {
      logger.error(`Batch starting at index ${i} failed`, err.message);
      batch.forEach(f => results.set(f.path, { summary: "Unavailable", role: "unknown", issues: [] }));
    }
  }

  return results;
}

/**
 * Defensive parser for Gemini's text output.
 */
function parseGeminiOutput(text) {
  const summaryMatch = text.match(/SUMMARY:\s*(.*?)(?=\nROLE:|$)/s);
  const roleMatch = text.match(/ROLE:\s*(.*?)(?=\nISSUES:|$)/s);
  const issuesMatch = text.match(/ISSUES:\s*(.*?)(?=$)/s);

  return {
    summary: summaryMatch ? summaryMatch[1].trim() : "Summary unavailable",
    role: roleMatch ? roleMatch[1].trim() : "unknown",
    issues: issuesMatch ? issuesMatch[1].split(',').map(s => s.trim()).filter(Boolean) : []
  };
}
