/**
 * pipeline.js — Main background worker thread (ES Module version).
 */

import { workerData, parentPort } from 'worker_threads';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Helper for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import supabase from '../services/supabase.js';
import { runIngestion } from './stages/1_ingestion.js';
import { runStaticAnalysis } from './stages/2_staticAnalysis.js';
import { runCommitAnalysis, getAllBranches, tagFilesWithIssues } from './stages/3_commitAnalysis.js';
import { computeOnboardingPath } from './stages/4_aiSummaries.js';
import * as groq from '../services/groqService.js';
import { cleanup } from '../utils/cleanup.js';
import logger from '../utils/logger.js';

const { jobId, repoUrl, branch, taskDescription } = workerData;

const CLONE_BASE = process.env.CLONE_BASE_DIR
  ? path.resolve(process.env.CLONE_BASE_DIR)
  : path.join(os.tmpdir(), 'ran-repos');

const PREVIEW_LINES = 150;

async function updateProgress(stage, progress, status = 'running', errorMessage = null) {
  const update = { stage, progress, status, updated_at: new Date().toISOString() };
  if (errorMessage) update.error_message = errorMessage;

  await supabase.from('jobs').update(update).eq('id', jobId);

  if (parentPort) {
    parentPort.postMessage({ type: 'progress', data: { ...update, id: jobId } });
  }
}

async function runPipeline() {
  const cloneDir = path.join(CLONE_BASE, jobId);
  let repoId = null;

  try {
    // Stage 1: Ingestion
    await updateProgress(1, 5);
    const { files, commitSha, repoName, currentBranch, languageStats } = await runIngestion({
      repoUrl,
      branch: branch || 'HEAD',
      cloneDir,
      onProgress: async (percent, msg) => {
        logger.info(`[Job ${jobId}] Stage 1 (${percent}%): ${msg}`);
        await updateProgress(1, percent);
      },
    });

    // Cache check
    const { data: existingRepo } = await supabase
      .from('repos')
      .select('id, graph_json, ai_context')
      .eq('repo_url', repoUrl)
      .eq('branch', currentBranch)
      .eq('commit_sha', commitSha)
      .maybeSingle();

    if (existingRepo) {
      logger.info(`[Job ${jobId}] Cache HIT - checking if graph has realId`);
      
      // Check if graph nodes have realId (for file summary lookups)
      const graphHasRealId = existingRepo.graph_json?.nodes?.some((n) => n.realId);
      logger.info(`[Job ${jobId}] Graph has realId: ${graphHasRealId}`);
      
      if (!graphHasRealId) {
        logger.info(`[Job ${jobId}] Graph missing realId, updating with database IDs`);
        
        // Fetch files to get database IDs
        const { data: files, error: filesError } = await supabase
          .from('files')
          .select('id, file_path')
          .eq('repo_id', existingRepo.id);
        
        if (filesError) {
          logger.error(`[Job ${jobId}] Error fetching files: ${filesError.message}`);
        } else if (files && files.length > 0) {
          logger.info(`[Job ${jobId}] Found ${files.length} files in database`);
          
          // Create path to database ID mapping
          const pathToDbId = new Map();
          files.forEach((fr) => pathToDbId.set(fr.file_path, fr.id));
          
          // Update graph nodes with database IDs
          const updatedGraphNodes = existingRepo.graph_json.nodes.map((node) => ({
            ...node,
            realId: pathToDbId.get(node.path) || node.id,
          }));
          
          const updatedGraphJson = {
            ...existingRepo.graph_json,
            nodes: updatedGraphNodes,
          };
          
          logger.info(`[Job ${jobId}] Updating graph with realId for ${updatedGraphNodes.length} nodes`);
          
          const { error: updateError } = await supabase.from('repos').update({ 
            graph_json: updatedGraphJson 
          }).eq('id', existingRepo.id);
          
          if (updateError) {
            logger.error(`[Job ${jobId}] Error updating graph: ${updateError.message}`);
          } else {
            logger.info(`[Job ${jobId}] Graph updated with realId successfully`);
          }
        } else {
          logger.warn(`[Job ${jobId}] No files found in database for repo ${existingRepo.id}`);
        }
      }
      
      // Check if AI context exists
      if (!existingRepo.ai_context || !existingRepo.ai_context.summary) {
        logger.info(`[Job ${jobId}] AI context missing, running AI analysis with Groq`);
        
        const { data: files } = await supabase
          .from('files')
          .select('id, file_path')
          .eq('repo_id', existingRepo.id);
        
        if (files && files.length > 0) {
          await updateProgress(4, 65);
          
          const topFiles = files.slice(0, 10).map(f => ({ path: f.file_path }));
          const entryPoints = [];
          
          logger.info(`[Job ${jobId}] Calling Groq generateRepoContext`);
          const contextSummary = await groq.generateRepoContext(existingRepo, topFiles, entryPoints);
          logger.info(`[Job ${jobId}] Groq response received`);
          
          await supabase.from('repos').update({
            ai_context: {
              ...contextSummary,
              generated_at: new Date().toISOString(),
              tokens: 200
            }
          }).eq('id', existingRepo.id);
          
          logger.info(`[Job ${jobId}] AI context saved to database`);
        }
        
        await updateProgress(4, 100, 'done');
      } else {
        logger.info(`[Job ${jobId}] AI context exists, skipping AI analysis`);
      }
      
      await supabase.from('repos').update({ job_id: jobId }).eq('id', existingRepo.id);
      await updateProgress(4, 100, 'done');
      await cleanup(cloneDir);
      return;
    }

    // Stage 2: Static Analysis
    await updateProgress(2, 15);
    const { analyzedFiles, graphJson, pathToId } = await runStaticAnalysis(files, async (percent, msg) => {
      logger.info(`[Job ${jobId}] Stage 2 (${percent}%): ${msg}`);
      await updateProgress(2, percent);
    });

    // Stage 3: Commit Analysis
    await updateProgress(3, 50);
    const { commits, issueToFiles } = await runCommitAnalysis(cloneDir, currentBranch, async (percent, msg) => {
      logger.info(`[Job ${jobId}] Stage 3 (${percent}%): ${msg}`);
      await updateProgress(3, percent);
    });

    tagFilesWithIssues(analyzedFiles, issueToFiles);

    // Save files first to get database IDs
    const fileRecords = analyzedFiles.map((f) => ({
      id: uuidv4(),
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
    }));

    for (let i = 0; i < fileRecords.length; i += 500) {
      const { error } = await supabase.from('files').insert(fileRecords.slice(i, i + 500));
      if (error) throw new Error(`Failed to save files: ${error.message}`);
    }

    // Create path to database ID mapping for graph nodes
    const pathToDbId = new Map();
    fileRecords.forEach((fr) => pathToDbId.set(fr.file_path, fr.id));

    // Update graph nodes with database IDs
    const updatedGraphNodes = graphJson.nodes.map((node) => ({
      ...node,
      realId: pathToDbId.get(node.path) || node.id,
    }));

    const updatedGraphJson = {
      ...graphJson,
      nodes: updatedGraphNodes,
    };

    // Save initial repo record with updated graph
    repoId = uuidv4();
    const repoRecord = {
      id: repoId,
      job_id: jobId,
      repo_url: repoUrl,
      repo_name: repoName,
      branch: currentBranch,
      commit_sha: commitSha,
      graph_json: updatedGraphJson,
      file_tree: buildFileTree(analyzedFiles),
      language_stats: languageStats,
      total_files: files.length,
      analyzed_files: analyzedFiles.length,
    };
    await supabase.from('repos').insert(repoRecord);

    // Save commits
    const commitRecords = commits.map((c) => ({
      repo_id: repoId,
      commit_hash: c.commit_hash,
      message: c.message,
      author: c.author,
      authored_at: c.authored_at,
      branch: c.branch,
      issue_refs: c.issue_refs,
      files_touched: c.files_touched,
    }));

    for (let i = 0; i < commitRecords.length; i += 200) {
      const { error } = await supabase.from('commits').insert(commitRecords.slice(i, i + 200));
      if (error) throw new Error(`Failed to save commits: ${error.message}`);
    }

    // ── Stage 4: AI Summaries REWRITE ─────────────────────────────────────────
    await updateProgress(4, 65);

    // 1. Generate repo context once
    const topFiles = analyzedFiles
      .sort((a, b) => (b.importance || 0) - (a.importance || 0))
      .slice(0, 10);
    const entryPoints = analyzedFiles.filter(f => f.is_entry_point).map(f => f.path);

    const contextSummary = await groq.generateRepoContext(repoRecord, topFiles, entryPoints);

    // Save context to repo
    await supabase.from('repos').update({
      ai_context: {
        ...contextSummary,
        generated_at: new Date().toISOString(),
        tokens: 200 // estimated
      }
    }).eq('id', repoId);

    // 2. Process file summaries in batches
    const filesToSummarize = analyzedFiles.map(f => ({
      path: f.path,
      content: readFilePreview(f.absolutePath, 150)
    }));

    const summariesMap = await groq.generateFileSummariesBatch(filesToSummarize, contextSummary.summary || typeof contextSummary === 'string' ? contextSummary : '');

    // 3. Persist summaries and update progress incrementally
    let processed = 0;
    for (const [filePath, result] of summariesMap.entries()) {
      const fileRecord = fileRecords.find(fr => fr.file_path === filePath);
      if (fileRecord) {
        await supabase.from('files')
          .update({ summary: result.summary })
          .eq('id', fileRecord.id);
      }
      processed++;
      const progress = 65 + Math.floor((processed / summariesMap.size) * 25); // 65 -> 90
      if (processed % 5 === 0) await updateProgress(4, progress);
    }

    // Final Repo Analysis (Onboarding & Insights)
    const onboardingPath = computeOnboardingPath(analyzedFiles, taskDescription, summariesMap);
    await supabase.from('repos').update({ onboarding_path: onboardingPath }).eq('id', repoId);

    await updateProgress(4, 100, 'done');
    logger.info(`[Job ${jobId}] ✅ Pipeline complete.`);

  } catch (err) {
    logger.error(`[Job ${jobId}] ❌ Pipeline failed:`, err);
    await updateProgress(0, 0, 'error', err.message);
  } finally {
    // Use the storage object path if available (not shown in current logic, assuming null for now)
    await cleanup(cloneDir, null);
  }
}

function readFilePreview(absolutePath, maxLines = PREVIEW_LINES) {
  if (!absolutePath) return '';
  try {
    return fs.readFileSync(absolutePath, 'utf8').split('\n').slice(0, maxLines).join('\n');
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

runPipeline().catch((err) => {
  logger.error('[Worker] Unhandled error:', err);
  process.exit(1);
});
