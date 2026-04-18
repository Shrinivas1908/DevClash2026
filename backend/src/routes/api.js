/**
 * routes/api.js — REST endpoints for the Repository Architecture Navigator (ES Module).
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import supabase from '../services/supabase.js';
import jobEvents from '../services/events.js';
import * as gemini from '../services/geminiService.js';
import logger from '../utils/logger.js';
import path from 'path';

const router = express.Router();

function validateGithubUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'github.com' && parsed.pathname.split('/').filter(Boolean).length >= 2;
  } catch {
    return false;
  }
}

router.post('/jobs', async (req, res) => {
  const { repo_url, task_description = '', branch = 'HEAD' } = req.body;

  if (!repo_url) return res.status(400).json({ error: 'repo_url is required' });
  if (!validateGithubUrl(repo_url)) return res.status(400).json({ error: 'Invalid GitHub URL' });

  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      id: uuidv4(),
      repo_url: repo_url.trim(),
      branch: branch || 'HEAD',
      task_description: task_description.trim(),
      status: 'pending',
      stage: 0,
      progress: 0,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: 'Failed to create analysis job' });

  return res.status(202).json({ job_id: job.id, jobId: job.id });
});

router.get('/jobs/:id', async (req, res) => {
  const { data: job, error } = await supabase
    .from('jobs')
    .select('*, repos(*)')
    .eq('id', req.params.id)
    .single();

  if (error || !job) return res.status(404).json({ error: 'Job not found' });

  const statusMap = { pending: 'pending', running: 'processing', done: 'complete', error: 'failed' };
  const stages = [1, 2, 3, 4].map((stageNum) => ({
    stage: stageNum,
    name: ['Repo Ingestion', 'Static Analysis', 'Commit Analysis', 'AI Summaries'][stageNum - 1],
    status: job.stage > stageNum ? 'complete' : job.stage === stageNum ? statusMap[job.status] : 'pending',
  }));

  const repo = job.repos?.[0] || null;

  return res.json({
    id: job.id,
    repo_url: job.repo_url,
    status: statusMap[job.status],
    progress: job.progress,
    stage: job.stage,
    stages,
    ai_context: repo?.ai_context || null,
    repo_id: repo?.id || null,
    created_at: job.created_at,
    error_message: job.error_message,
  });
});

router.get('/jobs/:id/stream', async (req, res) => {
  const { id } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const { data: job } = await supabase.from('jobs').select('*').eq('id', id).single();
    if (job) res.write(`data: ${JSON.stringify(job)}\n\n`);
  } catch (err) { }

  const onJobUpdate = (update) => {
    if (update.id === id) res.write(`data: ${JSON.stringify(update)}\n\n`);
  };

  jobEvents.on('job_update', onJobUpdate);
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 30000);

  req.on('close', () => {
    jobEvents.off('job_update', onJobUpdate);
    clearInterval(heartbeat);
    res.end();
  });
});

router.get('/graph/:jobId', async (req, res) => {
  let { data: repo } = await supabase.from('repos').select('id, graph_json, repo_url, total_files, analyzed_files').eq('job_id', req.params.jobId).single();
  if (!repo) {
    const { data: job } = await supabase.from('jobs').select('repo_url').eq('id', req.params.jobId).single();
    if (job?.repo_url) {
      const { data: fallbackRepo } = await supabase.from('repos').select('id, graph_json, repo_url, total_files, analyzed_files').eq('repo_url', job.repo_url).order('created_at', { ascending: false }).limit(1).single();
      if (fallbackRepo) repo = fallbackRepo;
    }
  }

  if (!repo?.graph_json) return res.status(404).json({ error: 'Graph not found' });

  return res.json({
    nodes: repo.graph_json.nodes || [],
    edges: repo.graph_json.edges || [],
    insights: repo.graph_json.insights || null,
    metadata: { repo_id: repo.id, repo_url: repo.repo_url, total_files: repo.total_files, analyzed_files: repo.analyzed_files },
  });
});

router.get('/repo/:id/files', async (req, res) => {
  const { task, issue } = req.query;
  let query = supabase.from('files').select('id, file_path, language, importance, is_entry_point, summary, issues').eq('repo_id', req.params.id).order('importance', { ascending: false }).limit(500);
  if (issue) query = query.contains('issues', [issue]);
  const { data: files, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  let ranked = files || [];
  if (task?.trim()) {
    const keywords = task.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
    ranked = ranked.map((f) => {
      const haystack = `${f.file_path} ${f.summary || ''} ${(f.issues || []).join(' ')}`.toLowerCase();
      const score = keywords.reduce((acc, kw) => acc + (haystack.includes(kw) ? 1 : 0), 0);
      return { ...f, task_score: score };
    }).sort((a, b) => b.task_score - a.task_score || b.importance - a.importance);
  }
  return res.json(ranked);
});

router.get('/repo/:id/onboarding-path', async (req, res) => {
  const { data: repo } = await supabase.from('repos').select('onboarding_path').eq('id', req.params.id).single();
  return res.json({ onboarding_path: repo?.onboarding_path || [] });
});

router.get('/repo/:id/commits', async (req, res) => {
  const { data: commits, error } = await supabase
    .from('commits')
    .select('*')
    .eq('repo_id', req.params.id)
    .order('authored_at', { ascending: false })
    .limit(100);

  if (error) return res.status(500).json({ error: error.message });
  return res.json(commits || []);
});

router.post('/repo/:id/query', async (req, res) => {
  const { question } = req.body;
  const repoId = req.params.id;

  if (!question) return res.status(400).json({ error: 'Question is required' });

  try {
    const { data: repo, error: repoError } = await supabase
      .from('repos')
      .select('ai_context, repo_name, repo_url')
      .eq('id', repoId)
      .single();

    if (repoError || !repo) return res.status(404).json({ error: 'Repository not found' });

    const context = repo.ai_context?.summary || "No architectural context available.";
    const result = await gemini.queryRepository(question, context);

    // 3. Fetch latest commits for identified issues/keywords
    let relatedCommits = [];
    if (result.keywords && result.keywords.length > 0) {
      const { data: latestCommits } = await supabase
        .from('commits')
        .select('message, author, authored_at, commit_hash, issue_refs')
        .eq('repo_id', repoId)
        .order('authored_at', { ascending: false })
        .limit(15);

      relatedCommits = (latestCommits || []).filter(c =>
        (c.issue_refs || []).some(ref => result.keywords.includes(ref)) ||
        result.keywords.some(kw => c.message.toLowerCase().includes(kw.toLowerCase()))
      ).slice(0, 5);
    }

    let fileResults = [];
    if (result.files && result.files.length > 0) {
      const { data: dbFiles } = await supabase
        .from('files')
        .select('id, file_path, language, summary, importance')
        .eq('repo_id', repoId)
        .in('file_path', result.files);

      fileResults = dbFiles || [];
    }

    return res.json({
      explanation: result.explanation,
      files: fileResults,
      keywords: result.keywords,
      related_commits: relatedCommits
    });

  } catch (err) {
    logger.error('AI query failure:', err);
    return res.status(500).json({ error: 'Internal AI query failure' });
  }
});

router.get('/repo/:id/branches', async (req, res) => {
  const { data: commits, error } = await supabase
    .from('commits')
    .select('branch')
    .eq('repo_id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });

  const uniqueBranches = [...new Set((commits || []).map(c => c.branch))].filter(Boolean);
  return res.json(uniqueBranches);
});

router.get('/repo/:id/stats/issues', async (req, res) => {
  const repoId = req.params.id;

  try {
    // 1. Fetch commit-based issues
    const { data: commits } = await supabase
      .from('commits')
      .select('issue_refs, message, author, authored_at, commit_hash')
      .eq('repo_id', repoId);

    // 2. Fetch AI themes and top files
    const { data: repo } = await supabase.from('repos').select('ai_context').eq('id', repoId).single();
    const { data: files } = await supabase
      .from('files')
      .select('file_path, importance, is_entry_point')
      .eq('repo_id', repoId)
      .order('importance', { ascending: false })
      .limit(15);

    const issueStats = {};

    // A. Process commits (Direct matches)
    (commits || []).forEach(commit => {
      (commit.issue_refs || []).forEach(ref => {
        if (!issueStats[ref]) {
          issueStats[ref] = { issue: ref, count: 0, latest_commit: null, type: 'issue' };
        }
        issueStats[ref].count++;

        const commitDate = new Date(commit.authored_at);
        if (!issueStats[ref].latest_commit || commitDate > new Date(issueStats[ref].latest_commit.authored_at)) {
          issueStats[ref].latest_commit = {
            hash: commit.commit_hash,
            message: commit.message,
            author: commit.author,
            authored_at: commit.authored_at
          };
        }
      });
    });

    // B. Inject AI Themes if data is sparse
    const aiThemes = repo?.ai_context?.issues || [];
    aiThemes.forEach(theme => {
      const key = `[AI] ${theme}`;
      if (!issueStats[key]) {
        issueStats[key] = {
          issue: theme,
          count: 10, // AI themes are highly important
          type: 'theme'
        };
      }
    });

    // C. Inject Top Files as "Activity Centers"
    (files || []).forEach(f => {
      const fileName = path.basename(f.file_path);
      const key = fileName;
      if (!issueStats[key] && f.importance > 10) {
        issueStats[key] = {
          issue: fileName,
          count: f.importance,
          type: 'file',
          file_path: f.file_path
        };
      }
    });

    const sortedStats = Object.values(issueStats)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    return res.json(sortedStats);

  } catch (err) {
    logger.error('Failed to fetch issue stats:', err);
    return res.status(500).json({ error: 'Failed to fetch issue statistics' });
  }
});

export default router;
