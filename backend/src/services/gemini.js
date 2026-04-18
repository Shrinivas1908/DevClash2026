require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;
let model = null;

const REQUEST_INTERVAL_MS = 5000;
let lastRequestTime = 0;
let requestQueue = Promise.resolve();

function getModel() {
  if (model) return model;
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set');
  }
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  return model;
}


/**
 * Wait for rate-limit window before making a request.
 * Ensures only one request fires every REQUEST_INTERVAL_MS.
 */
async function rateLimitWait() {
  const nextRequest = requestQueue.then(async () => {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < REQUEST_INTERVAL_MS) {
      await new Promise((r) => setTimeout(r, REQUEST_INTERVAL_MS - elapsed));
    }
    lastRequestTime = Date.now();
  });
  
  requestQueue = nextRequest;
  return nextRequest;
}


/**
 * Generate AI summaries for a batch of files.
 * 
 * @param {Array<{path: string, language: string, content: string, imports: string[], exports: string[]}>} fileBatch
 * @returns {Promise<Map<string, string>>} Map of file_path -> summary
 */
async function generateFileSummaries(fileBatch) {
  const results = new Map();

  if (!fileBatch || fileBatch.length === 0) return results;

  // Build the prompt
  const fileBlocks = fileBatch.map((f, i) => {
    const importsList = f.imports.slice(0, 10).join(', ') || 'none';
    const exportsList = f.exports.slice(0, 10).join(', ') || 'none';
    const codePreview = f.content.split('\n').slice(0, 80).join('\n');

    return `FILE:${i + 1} PATH:${f.path} LANG:${f.language}
IMPORTS: ${importsList}
EXPORTS: ${exportsList}
CODE_PREVIEW:
\`\`\`
${codePreview}
\`\`\``;
  }).join('\n\n---\n\n');

  const prompt = `You are a Principal Software Architect. Your task is to analyze ${fileBatch.length} file(s) from a complex software project and provide a high-level architectural summary for each.

For each file, analyze:
1. Its core responsibility (Single Responsibility Principle check).
2. Key architectural patterns it implements (e.g., Factory, Singleton, Middleware, Hook).
3. Critical dependencies and how it interacts with the rest of the system.
4. Any potential technical debt or complexity hotspots.

Respond EXACTLY in this format (plain text only, no markdown formatting inside the summary):
FILE:1 SUMMARY: <Professional 2-3 sentence architectural summary>
FILE:2 SUMMARY: <...>

Keep summaries concise, technical, and objective. Avoid "This file is..." filler.

FILES TO ANALYZE:

${fileBlocks}`;

  try {
    await rateLimitWait();
    const geminiModel = getModel();
    const result = await geminiModel.generateContent(prompt);
    const text = result.response.text();

    // Parse the structured response
    const fileMarkers = text.matchAll(/FILE:(\d+)\s+SUMMARY:\s*([\s\S]*?)(?=FILE:\d+|$)/g);
    let found = false;
    for (const match of fileMarkers) {
      const idx = parseInt(match[1], 10) - 1;
      if (idx >= 0 && idx < fileBatch.length) {
        results.set(fileBatch[idx].path, match[2].trim());
        found = true;
      }
    }

    // Fallback: if no markers found, try simpler line-by-line
    if (!found) {
      const lines = text.split('\n');
      for (const line of lines) {
        const match = line.match(/FILE:?(\d+)[^S]*SUMMARY:?\s*(.+)$/i);
        if (match) {
          const idx = parseInt(match[1], 10) - 1;
          if (idx >= 0 && idx < fileBatch.length) {
            results.set(fileBatch[idx].path, match[2].trim());
          }
        }
      }
    }


  } catch (err) {
    console.warn(`[Gemini] Batch summary failed: ${err.message}`);
    // Return fallback summaries for this batch
    for (const f of fileBatch) {
      results.set(f.path, `${f.path} — a ${f.language} file with ${f.exports.length} export(s) and ${f.imports.length} import(s). (AI summary unavailable)`);
    }
  }

  return results;
}

/**
 * Answer a technical question based on relevant file context.
 */
async function answerQuery(question, files) {
  try {
    await rateLimitWait();
    const geminiModel = getModel();

    const context = files.map(f => `Path: ${f.file_path}\nSummary: ${f.summary}`).join('\n\n');

    const prompt = `You are a Principal Software Architect. A developer is asking a question about the repository.
Based on the following relevant files and their summaries, answer the question accurately and concisely.

QUESTION: "${question}"

RELEVANT FILES:
${context}

Provide a 2-3 sentence technical answer explaining where and how the requested functionality is implemented. If the answer isn't clear from the files, say so.`;

    const result = await geminiModel.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.warn('[Gemini] Query answer failed:', err.message);
    return "I found some relevant files but couldn't generate a detailed explanation right now.";
  }
}

/**
 * Generate a high-level architectural overview of the entire repository.
 */
async function generateRepoInsights(repoName, fileTree, topFiles) {
  try {
    await rateLimitWait();
    const geminiModel = getModel();

    const topFilesContext = topFiles.map(f => 
      `### FILE: ${f.path}\nSUMMARY: ${f.summary || 'Core component'}\nCODE_EXTRACT:\n${f.content}\n---`
    ).join('\n\n');

    const prompt = `You are a Lead Software Architect. Provide a high-level architectural overview of the repository "${repoName}".

I have extracted the source code and summaries for the most important files in this repository below. 
Analyze the actual code implementation to determine the design patterns, data flow, and architectural integrity.

TOP FILES SOURCE CODE:
${topFilesContext}

Provide your analysis in EXACTLY the following sections (plain text):
ARCHITECTURE_STYLE: (e.g., Modular Monolith, Microservices, Event-Driven, Layered MVC)
CORE_TECH_STACK: (Identify the primary languages and frameworks based on imports/code)
KEY_PATTERNS: (List 3-4 key design patterns or architectural choices found in the code)
MAINTAINABILITY_SCORE: (1-10 with a 1-sentence justification based on code quality)
QUICK_ONBOARDING_SUMMARY: (A 3-sentence guide for a new developer to understand the data flow)

Be technical, specific to the code provided, and concise.`;

    const result = await geminiModel.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.warn('[Gemini] Repo insights failed:', err.message);
    return 'Detailed architectural insights are being computed. Check back soon.';
  }
}

module.exports = { generateFileSummaries, answerQuery, generateRepoInsights };


