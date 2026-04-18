/**
 * routes/files.js — On-demand file summary handler with caching.
 */

import express from 'express';
import supabase from '../services/supabase.js';
import * as gemini from '../services/geminiService.js';
import logger from '../utils/logger.js';

const router = express.Router();

async function fetchGithubRawContent(repoUrl, commitSha, filePath) {
  try {
    const match = repoUrl.match(/github\.com\/([^/]+\/[^/]+)/);
    if (!match) return null;
    
    const ownerRepo = match[1].replace(/\.git$/, '');
    const rawUrl = `https://raw.githubusercontent.com/${ownerRepo}/${commitSha}/${filePath}`;
    
    const res = await fetch(rawUrl);
    if (!res.ok) {
      logger.warn(`Failed to fetch from GitHub: ${rawUrl} - ${res.statusText}`);
      return null;
    }
    
    return await res.text();
  } catch (err) {
    logger.error('Error fetching from GitHub:', err);
    return null;
  }
}

router.get('/:id/summary', async (req, res) => {
  const fileId = req.params.id;

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEnd = () => {
    res.write('event: end\ndata: \n\n');
    res.end();
  };

  try {
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('id, file_path, summary, repo_id, repos(repo_url, commit_sha, ai_context)')
      .eq('id', fileId)
      .single();

    if (fileError || !file) {
      res.write(`data: ${JSON.stringify('File not found.')}\n\n`);
      return sendEnd();
    }

    let summaryText = file.summary;

    if (!summaryText) {
      const repoContext = file.repos?.ai_context?.summary;
      if (!repoContext) {
        res.write(`data: Repository analysis in progress. Please wait.\n\n`);
        return sendEnd();
      }

      logger.info(`Cache miss for file ${fileId}. Fetching from GitHub...`);
      
      const fileContent = await fetchGithubRawContent(
        file.repos.repo_url, 
        file.repos.commit_sha, 
        file.file_path
      );
      
      const contentToAnalyze = fileContent 
        ? fileContent.substring(0, 8000) // limit size
        : "[Content unavailable - file too large or not found on GitHub]";

      const result = await gemini.generateFileSummary({
        file_path: file.file_path,
        content: contentToAnalyze 
      }, repoContext);

      summaryText = result.summary;

      await supabase.from('files')
        .update({ summary: summaryText })
        .eq('id', fileId);
    }

    // Simulate streaming for UI typing effect
    const words = summaryText.split(' ');
    for (const word of words) {
      res.write(`data: ${word} \n\n`);
      await new Promise(r => setTimeout(r, 30));
    }

    return sendEnd();

  } catch (err) {
    logger.error(`Failed to handle summary for file ${fileId}:`, err.message);
    res.write(`data: Error: ${err.message}\n\n`);
    return sendEnd();
  }
});

export default router;
