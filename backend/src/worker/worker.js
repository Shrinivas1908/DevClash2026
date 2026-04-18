/**
 * worker.js — Main background worker thread.
 * Spawned by jobManager.js via Node.js worker_threads.
 * Runs the 4-stage analysis pipeline and updates Supabase with progress.
 */

const { workerData, parentPort } = require('worker_threads');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');


// Load env vars (worker threads don't inherit dotenv)
require('dotenv').config({ path: path.resolve(__dirname, '../../..', '.env') });

const supabase = require('../services/supabase');
const { runIngestion, getRepoBranches } = require('./stages/1_ingestion');
const { runStaticAnalysis } = require('./stages/2_staticAnalysis');
const { runCommitAnalysis, getAllBranches, tagFilesWithIssues } = require('./stages/3_commitAnalysis');
const { runAiSummaries, computeOnboardingPath } = require('./stages/4_aiSummaries');
const { generateRepoInsights } = require('../services/gemini');

const { jobId, repoUrl, branch, taskDescription } = workerData;

const CLONE_BASE = process.env.CLONE_BASE_DIR
  ? path.resolve(process.env.CLONE_BASE_DIR)
  : path.join(os.tmpdir(), 'ran-repos');



/**
 * Update job progress in Supabase (triggers Realtime push to frontend).
 * Also notifies the parent thread for SSE streaming.
 */
async function updateProgress(stage, progress, status = 'running', errorMessage = null) {
  const update = { stage, progress, status, updated_at: new Date().toISOString() };
  if (errorMessage) update.error_message = errorMessage;
  
  // Update DB (source of truth)
  await supabase.from('jobs').update(update).eq('id', jobId);
  
  // Notify parent thread (for real-time SSE)
  if (parentPort) {
    parentPort.postMessage({ type: 'progress', data: { ...update, id: jobId } });
  }
}

/**
 * Main pipeline runner.
 */
async function runPipeline() {
  const cloneDir = path.join(CLONE_BASE, jobId);
  let repoId = null;

  try {
    // ── Stage 1: Repo Ingestion ─────────────────────────────────────────────
    await updateProgress(1, 5);

    const { files, commitSha, repoName, currentBranch, languageStats } = await runIngestion({
      repoUrl,
      branch: branch || 'HEAD',
      cloneDir,
      onProgress: async (percent, msg) => {
        console.log(`[Job ${jobId}] Stage 1 (${percent}%): ${msg}`);
        await updateProgress(1, percent);
      },
    });

    // ── Cache check: same repo + branch + commitSha already analyzed? ───────
    const { data: existingRepo } = await supabase
      .from('repos')
      .select('id, graph_json')
      .eq('repo_url', repoUrl)
      .eq('branch', currentBranch)
      .eq('commit_sha', commitSha)
      .maybeSingle();

    if (existingRepo) {
      console.log(`[Job ${jobId}] Cache HIT — returning existing analysis`);
      repoId = existingRepo.id;
      // Link job to existing repo and update repo with newest job_id
      await supabase.from('repos').update({ job_id: jobId }).eq('id', repoId);
      await supabase.from('jobs').update({
        status: 'done', stage: 4, progress: 100, updated_at: new Date().toISOString(),
      }).eq('id', jobId);
      cleanup(cloneDir);
      return;
    }


    // ── Stage 2: Static Analysis ────────────────────────────────────────────
    await updateProgress(2, 15);

    const { analyzedFiles, graphJson, pathToId } = await runStaticAnalysis(files, async (percent, msg) => {
      console.log(`[Job ${jobId}] Stage 2 (${percent}%): ${msg}`);
      await updateProgress(2, percent);
    });

    // ── Stage 3: Commit Analysis ────────────────────────────────────────────
    await updateProgress(3, 50);

    const { commits, issueToFiles } = await runCommitAnalysis(
      cloneDir, currentBranch, async (percent, msg) => {
        console.log(`[Job ${jobId}] Stage 3 (${percent}%): ${msg}`);
        await updateProgress(3, percent);
      }
    );

    // Tag each file with issues that touched it
    tagFilesWithIssues(analyzedFiles, issueToFiles);

    // Get all branches for branch categorization feature
    const allBranches = await getAllBranches(cloneDir);

    // ── Save repo record ─────────────────────────────────────────────────────
    repoId = uuidv4();
    const repoRecord = {
      id: repoId,
      job_id: jobId,
      repo_url: repoUrl,
      repo_name: repoName,
      branch: currentBranch,
      commit_sha: commitSha,
      graph_json: graphJson,
      file_tree: buildFileTree(analyzedFiles),
      language_stats: languageStats,
      total_files: files.length,
      analyzed_files: analyzedFiles.length,
    };

    const { error: repoInsertError } = await supabase.from('repos').insert(repoRecord);
    if (repoInsertError) throw new Error(`Failed to insert repo: ${repoInsertError.message}`);

    // ── Save files to Supabase ────────────────────────────────────────────────
    await updateProgress(3, 60);
    const fileRecords = analyzedFiles.map((f) => ({
      id: pathToId.get(f.path) ? `${repoId}-${pathToId.get(f.path)}` : uuidv4(),
      repo_id: repoId,
      file_path: f.path,
      language: f.language,
      size_bytes: f.sizeBytes,
      fan_in: f.fan_in,
      fan_out: f.fan_out,
      importance: f.importance,
      is_entry_point: f.is_entry_point || false,
      exports: f.exports || [],
      imports: f.imports || [],
      issues: f.issues || [],
      summary: null, // filled in stage 4
    }));

    // Insert in batches of 500
    for (let i = 0; i < fileRecords.length; i += 500) {
      const batch = fileRecords.slice(i, i + 500);
      await supabase.from('files').insert(batch);
    }

    // Save commits
    if (commits.length > 0) {
      const commitRecords = commits.map((c) => ({
        id: uuidv4(),
        repo_id: repoId,
        ...c,
      }));
      for (let i = 0; i < commitRecords.length; i += 500) {
        await supabase.from('commits').insert(commitRecords.slice(i, i + 500));
      }
    }

    // ── Stage 4: AI Summaries ─────────────────────────────────────────────────
    await updateProgress(4, 65);

    const summaries = await runAiSummaries(
      analyzedFiles,
      commitSha,
      new Map(),
      async (percent, msg) => {
        console.log(`[Job ${jobId}] Stage 4 (${percent}%): ${msg}`);
        await updateProgress(4, percent);
      }
    );

    // Write summaries back to Supabase files table
    for (const [filePath, summary] of summaries.entries()) {
      const fileRecord = fileRecords.find((f) => f.file_path === filePath);
      if (fileRecord) {
        await supabase
          .from('files')
          .update({ summary })
          .eq('id', fileRecord.id);
          
        // Update the node in graph_json with the real DB ID and summary
        const node = graphJson.nodes.find(n => n.path === filePath);
        if (node) {
          node.realId = fileRecord.id;
          node.summary = summary;
          node.last_commit_sha = commitSha;
        }
      }
    }

    // Save the updated graph_json back to the repo record
    await supabase.from('repos').update({ graph_json: graphJson }).eq('id', repoId);


    // ── Generate Global Insights ──────────────────────────────────────────────
    console.log(`[Job ${jobId}] Generating global architectural insights from source code…`);
    
    // Pick top 5 most critical files and include their code for deep analysis
    const topFilesForDeepAnalysis = analyzedFiles
      .sort((a, b) => (b.importance || 0) - (a.importance || 0))
      .slice(0, 5)
      .map(f => ({
        path: f.path,
        summary: summaries.get(f.path),
        content: readFilePreview(f.absolutePath, 150) // Send up to 150 lines for the most important files
      }));
      
    const insights = await generateRepoInsights(repoName, repoRecord.file_tree, topFilesForDeepAnalysis);
    
    // Save updated graph and insights
    await supabase.from('repos').update({ 
      graph_json: { ...graphJson, insights },
    }).eq('id', repoId);

    // ── Compute onboarding path ───────────────────────────────────────────────
    const onboardingPath = computeOnboardingPath(analyzedFiles, taskDescription, summaries);
    await supabase.from('repos').update({ onboarding_path: onboardingPath }).eq('id', repoId);

    // ── Final: mark job done ─────────────────────────────────────────────────
    await updateProgress(4, 100, 'done');

    console.log(`[Job ${jobId}] ✅ Pipeline complete. Repo: ${repoId}`);

  } catch (err) {
    console.error(`[Job ${jobId}] ❌ Pipeline failed:`, err);
    await updateProgress(0, 0, 'error', err.message);
  } finally {
    cleanup(cloneDir);
  }
}

/**
 * Build a simple file tree JSON for the frontend explorer.
 */
function readFilePreview(absolutePath, maxLines = PREVIEW_LINES) {
  if (!absolutePath) return '';
  try {
    const content = fs.readFileSync(absolutePath, 'utf8');
    return content.split('\n').slice(0, maxLines).join('\n');
  } catch {
    return '';
  }
}

function buildFileTree(files) {
  const tree = {};
  for (const f of files) {
    const parts = f.path.split('/');
    let node = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node[parts[i]]) node[parts[i]] = {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = { type: 'file', language: f.language, size: f.sizeBytes };
  }
  return tree;
}

/**
 * Remove the cloned repository directory after analysis.
 */
function cleanup(cloneDir) {
  try {
    if (fs.existsSync(cloneDir)) {
      fs.rmSync(cloneDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn('[Worker] Cleanup failed:', err.message);
  }
}

// Run the pipeline
runPipeline().catch((err) => {
  console.error('[Worker] Unhandled error:', err);
  process.exit(1);
});
