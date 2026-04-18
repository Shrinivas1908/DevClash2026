/**
 * services/groqService.js — Groq API service for AI summaries.
 */

import logger from '../utils/logger.js';

const MODEL = "llama-3.3-70b-versatile";
const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

function getGroqConfig() {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  const GROQ_ENABLED = !!GROQ_API_KEY && GROQ_API_KEY !== 'your_groq_api_key_here';
  return { GROQ_API_KEY, GROQ_ENABLED };
}

/**
 * Simple Rate Limiter to handle API rate limits.
 */
class RateLimiter {
  constructor(maxRequestsPerMinute = 60, minIntervalMs = 1000) {
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

    // Ensure min interval between requests
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
      logger.warn(`Groq attempt ${attempt} failed: ${err.message}. Retrying in ${backoff}ms...`);
      await new Promise(r => setTimeout(r, backoff));
      attempt++;
    }
  }
}

/**
 * Core Groq API call.
 * @param {string} prompt 
 * @returns {Promise<string>}
 */
async function callGroq(prompt) {
  const { GROQ_API_KEY } = getGroqConfig();
  await limiter.throttle();

  return withRetry(async () => {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 2048
      })
    });

    const data = await response.json();

    if (!response.ok) {
      logger.error(`Groq API Error: ${response.status}`, JSON.stringify(data, null, 2));
      const error = new Error(`Groq API returned ${response.status}`);
      error.status = response.status;
      throw error;
    }

    try {
      return data.choices[0].message.content;
    } catch (err) {
      logger.error("Failed to parse Groq response structure", JSON.stringify(data, null, 2));
      throw new Error("Malformed Groq response");
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
  const { GROQ_ENABLED } = getGroqConfig();
  if (!GROQ_ENABLED) {
    logger.info("Groq is disabled, returning default context");
    return {
      summary: "A complex software project with multiple interconnected components.",
      role: "Unknown",
      issues: []
    };
  }

  logger.info(`Generating repo context for ${repo.repo_name}`);

  const prompt = `Analyze this repository metadata and provide a high-level architectural description.

REPO: ${repo.repo_name}
URL: ${repo.repo_url}
ENTRY POINTS: ${entryPoints.join(', ')}
KEY FILES: ${topFiles.map(f => f.path).join(', ')}
LANGUAGES: ${JSON.stringify(repo.language_stats)}

Provide your response in this exact JSON format:
{
  "summary": "2-3 sentence architectural overview",
  "role": "primary architectural role (e.g., API Service, Web App, Library)",
  "issues": ["theme1", "theme2", "theme3"]
}

Only return valid JSON, no other text.`;

  try {
    const response = await callGroq(prompt);

    // Try to parse JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || response.substring(0, 500),
        role: parsed.role || "Unknown",
        issues: Array.isArray(parsed.issues) ? parsed.issues : []
      };
    }

    // Fallback if no JSON found
    return {
      summary: response.substring(0, 500),
      role: "Unknown",
      issues: []
    };
  } catch (err) {
    logger.error("generateRepoContext failed", err.message);
    return {
      summary: "A complex software project with multiple interconnected components.",
      role: "Unknown",
      issues: []
    };
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
  const { GROQ_ENABLED } = getGroqConfig();
  if (!GROQ_ENABLED) {
    logger.info("Groq is disabled, returning default summary");
    return { summary: "Unavailable", role: "unknown", issues: [] };
  }

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
    const text = await callGroq(prompt);
    return parseGroqOutput(text);
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
  const { GROQ_ENABLED } = getGroqConfig();
  if (!GROQ_ENABLED) {
    logger.info("Groq is disabled, returning default summaries for all files");
    const results = new Map();
    files.forEach(f => results.set(f.path, { summary: "Unavailable", role: "unknown", issues: [] }));
    return results;
  }

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
      const text = await callGroq(prompt);

      // Parse multi-file response
      const fileMatches = text.split(/FILE:\d+/).filter(Boolean);
      batch.forEach((f, idx) => {
        if (fileMatches[idx]) {
          results.set(f.path, parseGroqOutput(fileMatches[idx]));
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
 * Generate an AI response for a user query about the repository.
 * 
 * @param {string} query - User's question
 * @param {string} context - Repository context and relevant code
 * @returns {Promise<string>} AI response
 */
export async function generateQueryResponse(query, context) {
  const { GROQ_ENABLED } = getGroqConfig();
  if (!GROQ_ENABLED) {
    logger.info("Groq is disabled, returning default response");
    return "AI features are currently disabled. Please configure the GROQ_API_KEY to enable AI-powered queries.";
  }

  logger.info(`Generating response for query: ${query.substring(0, 50)}...`);

  const prompt = `You are a helpful code analysis assistant. Answer the user's question based on the provided repository context and code.

[REPOSITORY CONTEXT]
${context}

[USER QUESTION]
${query}

Provide a clear, concise answer with specific references to the code when relevant.`;

  try {
    return await callGroq(prompt);
  } catch (err) {
    logger.error("generateQueryResponse failed", err.message);
    return "Sorry, I encountered an error while processing your query. Please try again.";
  }
}

/**
 * Query repository with natural language and return structured response.
 * 
 * @param {string} question - User's question
 * @param {string} context - Repository context
 * @returns {Promise<Object>} { explanation, files[], keywords[] }
 */
export async function queryRepository(question, context) {
  const { GROQ_ENABLED } = getGroqConfig();
  if (!GROQ_ENABLED) {
    logger.info("Groq is disabled, returning default response");
    return {
      explanation: "AI features are currently disabled. Please configure the GROQ_API_KEY to enable AI-powered queries.",
      files: [],
      keywords: []
    };
  }

  logger.info(`Querying repository with: ${question.substring(0, 50)}...`);

  const prompt = `You are a code analysis assistant. Answer the user's question about the repository.

[REPOSITORY CONTEXT]
${context}

[USER QUESTION]
${question}

IMPORTANT INSTRUCTIONS:
- If the user asks about file locations (e.g., "where are auth files", "find authentication files"), provide the exact file paths in the "files" array
- Extract relevant keywords from the question and context (e.g., "auth", "authentication", "login", "user")
- The "files" array should contain actual file paths from the repository that match the user's query
- The "keywords" array should contain search terms that would help find relevant files

Provide your response in this exact JSON format:
{
  "explanation": "Your detailed answer here. Mention specific files if relevant.",
  "files": ["src/auth/login.ts", "src/components/AuthButton.tsx"],
  "keywords": ["auth", "authentication", "login", "user"]
}

Only return valid JSON, no other text.`;

  try {
    const response = await callGroq(prompt);

    // Try to parse JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        explanation: parsed.explanation || response,
        files: Array.isArray(parsed.files) ? parsed.files : [],
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : []
      };
    }

    // Fallback if no JSON found
    return {
      explanation: response,
      files: [],
      keywords: []
    };
  } catch (err) {
    logger.error("queryRepository failed", err.message);
    return {
      explanation: "Sorry, I encountered an error while processing your query. Please try again.",
      files: [],
      keywords: []
    };
  }
}

/**
 * Defensive parser for Groq's text output.
 */
function parseGroqOutput(text) {
  const summaryMatch = text.match(/SUMMARY:\s*(.*?)(?=\nROLE:|$)/s);
  const roleMatch = text.match(/ROLE:\s*(.*?)(?=\nISSUES:|$)/s);
  const issuesMatch = text.match(/ISSUES:\s*(.*?)(?=$)/s);

  return {
    summary: summaryMatch ? summaryMatch[1].trim() : "Summary unavailable",
    role: roleMatch ? roleMatch[1].trim() : "unknown",
    issues: issuesMatch ? issuesMatch[1].split(',').map(s => s.trim()).filter(Boolean) : []
  };
}
