/**
 * routes/api.js — All 9 REST endpoints for the Repository Architecture Navigator.
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../services/supabase');
const { answerQuery } = require('../services/gemini');
const { getAllBranches } = require('../worker/stages/3_commitAnalysis');

const router = express.Router();

// ─── Helper ───────────────────────────────────────────────────────────────────

function validateGithubUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'github.com' && parsed.pathname.split('/').filter(Boolean).length >= 2;
  } catch {
    return false;
  }
}

// ─── POST /api/repo/analyze ───────────────────────────────────────────────────
// Accepts {repo_url, task_description, branch}, creates a job, returns {job_id}
router.post('/repo/analyze', async (req, res) => {
  const { repo_url, task_description = '', branch = 'HEAD' } = req.body;

  if (!repo_url) {
    return res.status(400).json({ error: 'repo_url is required' });
  }

  if (!validateGithubUrl(repo_url)) {
    return res.status(400).json({ error: 'Invalid GitHub URL. Must be https://github.com/owner/repo' });
  }

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

  if (error) {
    console.error('[API] Insert job failed:', error);
    return res.status(500).json({ error: 'Failed to create analysis job' });
  }

  console.log(`[API] Job created: ${job.id} for ${repo_url}`);
  return res.status(202).json({ job_id: job.id, jobId: job.id });
});

// ─── POST /api/jobs (alias for frontend compatibility) ────────────────────────
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

  if (error) return res.status(500).json({ error: 'Failed to create job' });

  return res.status(202).json({ jobId: job.id, job_id: job.id });
});

// ─── GET /api/job/:id/status ──────────────────────────────────────────────────
// Polling fallback; returns {status, stage, progress, error}
router.get('/job/:id/status', async (req, res) => {
  const { data: job, error } = await supabase
    .from('jobs')
    .select('id, status, stage, progress, error_message, updated_at')
    .eq('id', req.params.id)
    .single();

  if (error || !job) return res.status(404).json({ error: 'Job not found' });

  return res.json({
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    error: job.error_message,
    updated_at: job.updated_at,
  });
});

// ─── GET /api/jobs/:id ────────────────────────────────────────────────────────
// Full job object (used by frontend useJobRealtime hook)
router.get('/jobs/:id', async (req, res) => {
  const { data: job, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !job) return res.status(404).json({ error: 'Job not found' });

  // Map DB status to frontend JobStatus type
  const statusMap = {
    pending: 'pending',
    running: 'processing',
    done: 'complete',
    error: 'failed',
  };

  // Build stages array compatible with frontend PipelineStage type
  const stages = [1, 2, 3, 4].map((stageNum) => ({
    stage: stageNum,
    name: ['Repo Ingestion', 'Static Analysis', 'Commit Analysis', 'AI Summaries'][stageNum - 1],
    status:
      job.stage > stageNum
        ? 'complete'
        : job.stage === stageNum
        ? job.status === 'error'
          ? 'failed'
          : 'running'
        : 'waiting',
    started_at: null,
    completed_at: null,
  }));

  return res.json({
    id: job.id,
    repo_url: job.repo_url,
    status: statusMap[job.status] || job.status,
    stages,
    graph_json: null, // not embedded here; use /api/graph/:jobId
    created_at: job.created_at,
    error_message: job.error_message,
  });
});

// ─── GET /api/job/:id/repo ────────────────────────────────────────────────────
// Returns repo_id + metadata once analysis completes
router.get('/job/:id/repo', async (req, res) => {
  const { data: job } = await supabase
    .from('jobs')
    .select('id, status')
    .eq('id', req.params.id)
    .single();

  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status !== 'done') return res.status(202).json({ status: job.status, message: 'Analysis not complete yet' });

  const { data: repo, error } = await supabase
    .from('repos')
    .select('id, repo_url, repo_name, branch, commit_sha, language_stats, total_files, analyzed_files')
    .eq('job_id', req.params.id)
    .single();

  if (error || !repo) return res.status(404).json({ error: 'Repo not found' });

  return res.json(repo);
});

// ─── GET /api/graph/:jobId ────────────────────────────────────────────────────
// Returns React-Flow compatible graph JSON for a job
router.get('/graph/:jobId', async (req, res) => {
  let { data: repo, error } = await supabase
    .from('repos')
    .select('id, graph_json, repo_url, total_files, analyzed_files')
    .eq('job_id', req.params.jobId)
    .single();

  if (!repo) {
    // If not found by job_id, it might be a cache hit. Fall back to the latest repo for this URL.
    const { data: job } = await supabase.from('jobs').select('repo_url').eq('id', req.params.jobId).single();
    if (job && job.repo_url) {
      const { data: fallbackRepo } = await supabase
        .from('repos')
        .select('id, graph_json, repo_url, total_files, analyzed_files')
        .eq('repo_url', job.repo_url)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (fallbackRepo) repo = fallbackRepo;
    }
  }

  if (!repo) return res.status(404).json({ error: 'Graph not found. Analysis may still be running.' });
  if (!repo.graph_json) return res.status(404).json({ error: 'Graph not yet computed' });

  return res.json({
    nodes: repo.graph_json.nodes || [],
    edges: repo.graph_json.edges || [],
    metadata: {
      repo_url: repo.repo_url,
      total_files: repo.total_files,
      analyzed_files: repo.analyzed_files,
      scan_depth: 1,
    },
  });
});

// ─── GET /api/repo/:id/graph ──────────────────────────────────────────────────
// Returns React-Flow graph JSON for a repo ID (capped to top 200 nodes)
router.get('/repo/:id/graph', async (req, res) => {
  const { data: repo, error } = await supabase
    .from('repos')
    .select('graph_json, repo_url, total_files, analyzed_files')
    .eq('id', req.params.id)
    .single();

  if (error || !repo) return res.status(404).json({ error: 'Repo not found' });

  return res.json({
    nodes: repo.graph_json?.nodes || [],
    edges: repo.graph_json?.edges || [],
    metadata: {
      repo_url: repo.repo_url,
      total_files: repo.total_files,
      analyzed_files: repo.analyzed_files,
      scan_depth: 1,
    },
  });
});

// ─── GET /api/repo/:id/files ──────────────────────────────────────────────────
// Returns files ranked by importance; supports ?task= and ?issue= filters
router.get('/repo/:id/files', async (req, res) => {
  const { task, issue } = req.query;

  let query = supabase
    .from('files')
    .select('id, file_path, language, fan_in, fan_out, importance, is_entry_point, summary, issues')
    .eq('repo_id', req.params.id)
    .order('importance', { ascending: false })
    .limit(500);

  if (issue) {
    query = query.contains('issues', [issue]);
  }

  const { data: files, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Task-based ranking: keyword match in file path + summary + issue refs
  let ranked = files || [];
  if (task && task.trim()) {
    const keywords = task.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
    ranked = ranked
      .map((f) => {
        const haystack = `${f.file_path} ${f.summary || ''} ${(f.issues || []).join(' ')}`.toLowerCase();
        const matchScore = keywords.reduce((acc, kw) => acc + (haystack.includes(kw) ? 1 : 0), 0);
        return { ...f, task_score: matchScore };
      })
      .sort((a, b) => b.task_score - a.task_score || b.importance - a.importance);
  }

  return res.json(ranked);
});

// ─── GET /api/repo/:id/commits ────────────────────────────────────────────────
// Returns commit history; supports ?issue= and ?branch= filters
router.get('/repo/:id/commits', async (req, res) => {
  const { issue, branch } = req.query;

  let query = supabase
    .from('commits')
    .select('id, commit_hash, message, author, authored_at, branch, issue_refs, files_touched')
    .eq('repo_id', req.params.id)
    .order('authored_at', { ascending: false })
    .limit(200);

  if (issue) query = query.contains('issue_refs', [issue]);
  if (branch) query = query.eq('branch', branch);

  const { data: commits, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  return res.json(commits || []);
});

// ─── GET /api/files/:id/summary ───────────────────────────────────────────────
// SSE stream for AI summaries
router.get('/files/:id/summary', async (req, res) => {
  const { id } = req.params;

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const { data: file, error } = await supabase
      .from('files')
      .select('summary')
      .eq('id', id)
      .single();

    if (error || !file) {
      res.write(`data: ${JSON.stringify('Summary not found.')}\n\n`);
      return res.end();
    }

    const summary = file.summary || 'Analysis pending...';
    
    // Simulate streaming for better UI effect
    const words = summary.split(' ');
    for (const word of words) {
      res.write(`data: ${word} \n\n`);
      await new Promise(r => setTimeout(r, 40)); // small delay
    }
    
    res.write('event: end\ndata: \n\n');
    res.end();
  } catch (err) {
    res.write(`data: Error: ${err.message}\n\n`);
    res.end();
  }
});


// ─── POST /api/repo/:id/query ─────────────────────────────────────────────────
// Natural language search: tsvector full-text + Gemini explanation
router.post('/repo/:id/query', async (req, res) => {
  const { question } = req.body;
  if (!question || !question.trim()) {
    return res.status(400).json({ error: 'question is required' });
  }

  // Postgres full-text search via RPC
  const { data: searchResults, error } = await supabase.rpc('search_files', {
    p_repo_id: req.params.id,
    p_query: question.trim(),
  });

  if (error) {
    console.error('[API] search_files RPC error:', error);
    return res.status(500).json({ error: error.message });
  }

  const files = searchResults || [];

  // Extract keywords from question for highlighting
  const keywords = question.toLowerCase().split(/\W+/).filter((w) => w.length > 2);

  // Get AI explanation (non-blocking if Gemini fails)
  let explanation = `Found ${files.length} relevant file(s) for: "${question}"`;
  try {
    if (files.length > 0) {
      explanation = await answerQuery(question, files);
    }
  } catch (err) {
    console.warn('[API] Gemini query enhancement failed:', err.message);
  }

  return res.json({
    nodes: files.map((f) => f.id),
    files: files.map((f) => ({ id: f.id, file_path: f.file_path, rank: f.rank, summary: f.summary })),
    explanation,
    keywords,
  });
});

// ─── GET /api/repo/:id/onboarding-path ────────────────────────────────────────
// Returns ordered list of up to 20 files a new developer should read first
router.get('/repo/:id/onboarding-path', async (req, res) => {
  const { data: repo, error } = await supabase
    .from('repos')
    .select('onboarding_path')
    .eq('id', req.params.id)
    .single();

  if (error || !repo) return res.status(404).json({ error: 'Repo not found' });

  return res.json({ onboarding_path: repo.onboarding_path || [] });
});

// ─── GET /api/repo/:id/branches ───────────────────────────────────────────────
// Returns all branches of the analyzed repo with their metadata
router.get('/repo/:id/branches', async (req, res) => {
  const { data: repo, error } = await supabase
    .from('repos')
    .select('repo_url, branch')
    .eq('id', req.params.id)
    .single();

  if (error || !repo) return res.status(404).json({ error: 'Repo not found' });

  // Get all analyzed branches for this repo_url
  const { data: analyzedBranches } = await supabase
    .from('repos')
    .select('id, branch, commit_sha, analyzed_files, total_files, created_at')
    .eq('repo_url', repo.repo_url)
    .order('created_at', { ascending: false });

  // Categorize branches
  const categorized = categorizeBranches(analyzedBranches || [], repo.branch);

  return res.json({
    current_branch: repo.branch,
    branches: categorized,
  });
});

// ─── GET /api/repo/:repoUrl/available-branches ───────────────────────────────
// Returns GitHub branches via GitHub API (for branch selector dropdown)
router.get('/branches', async (req, res) => {
  const { repo_url } = req.query;
  if (!repo_url) return res.status(400).json({ error: 'repo_url is required' });

  try {
    const parsed = new URL(repo_url);
    const [, owner, repoName] = parsed.pathname.split('/');
    if (!owner || !repoName) throw new Error('Invalid GitHub URL');

    const headers = { 'Accept': 'application/vnd.github+json', 'User-Agent': 'RAN-Backend/1.0' };
    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const ghRes = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/branches?per_page=100`,
      { headers }
    );

    if (!ghRes.ok) throw new Error(`GitHub API error: ${ghRes.status}`);

    const branches = await ghRes.json();
    const categorized = categorizeBranches(
      branches.map((b) => ({ branch: b.name, commit_sha: b.commit?.sha })),
      'main'
    );

    return res.json({ branches: categorized });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Helper: Categorize branches ─────────────────────────────────────────────
function categorizeBranches(branches, currentBranch) {
  const categorize = (name) => {
    const n = (name || '').toLowerCase();
    if (n === 'main' || n === 'master' || n === 'trunk') return 'production';
    if (n.startsWith('release/') || n.startsWith('hotfix/')) return 'release';
    if (n.startsWith('feature/') || n.startsWith('feat/')) return 'feature';
    if (n.startsWith('fix/') || n.startsWith('bugfix/') || n.startsWith('bug/')) return 'bugfix';
    if (n.startsWith('chore/') || n.startsWith('refactor/') || n.startsWith('ci/')) return 'maintenance';
    if (n === 'dev' || n === 'develop' || n === 'development' || n === 'staging') return 'integration';
    return 'other';
  };

  return (branches || []).map((b) => ({
    ...b,
    category: categorize(b.branch || b.name),
    is_current: (b.branch || b.name) === currentBranch,
  }));
}

module.exports = router;
