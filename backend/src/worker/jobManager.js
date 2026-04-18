/**
 * jobManager.js — Polls Supabase for pending jobs and spawns worker threads.
 * Uses claim_next_job() SQL function (FOR UPDATE SKIP LOCKED) as an atomic job queue.
 * No Redis needed.
 */

const { Worker } = require('worker_threads');
const path = require('path');
const supabase = require('../services/supabase');
const jobEvents = require('../services/events');

const POLL_INTERVAL_MS = 2000;   // Check for new jobs every 2 seconds
const MAX_CONCURRENT = 2;        // Max simultaneous workers (free tier constraint)

let activeWorkers = 0;

const WORKER_PATH = path.resolve(__dirname, 'worker.js');

/**
 * Claim and start the next pending job.
 */
async function processNextJob() {
  if (activeWorkers >= MAX_CONCURRENT) return;

  try {
    // Atomically claim the next pending job
    const { data: result, error } = await supabase.rpc('claim_next_job');

    if (error) {
      console.error('[JobManager] claim_next_job error details:', error);
      return;
    }

    if (!result || (Array.isArray(result) && result.length === 0)) return; // No pending jobs
    const job = Array.isArray(result) ? result[0] : result;
    
    if (!job || !job.id) return;

    console.log(`[JobManager] Starting job ${job.id} for ${job.repo_url} (branch: ${job.branch || 'HEAD'})`);
    activeWorkers++;

    const worker = new Worker(WORKER_PATH, {
      workerData: {
        jobId: job.id,
        repoUrl: job.repo_url,
        branch: job.branch || 'HEAD',
        taskDescription: job.task_description || '',
      },
    });

    // Listen for progress updates from the worker thread
    worker.on('message', (msg) => {
      if (msg.type === 'progress') {
        console.log(`[JobManager] Progress update for ${job.id}: Stage ${msg.data.stage} (${msg.data.progress}%)`);
        jobEvents.emit('job_update', msg.data);
      }
    });

    worker.on('error', (err) => {
      console.error(`[JobManager] Worker error for job ${job.id}:`, err);
      activeWorkers--;
      // Emit error state to notify connected SSE clients
      jobEvents.emit('job_update', { 
        id: job.id, 
        status: 'error', 
        error_message: err.message,
        updated_at: new Date().toISOString() 
      });
    });

    worker.on('exit', (code) => {
      console.log(`[JobManager] Worker for job ${job.id} exited with code ${code}`);
      activeWorkers--;
    });

  } catch (err) {
    console.error('[JobManager] Unexpected error:', err.message);
  }
}

/**
 * Start the job polling loop.
 */
function startJobManager() {
  console.log('[JobManager] Started — polling every', POLL_INTERVAL_MS, 'ms');
  setInterval(processNextJob, POLL_INTERVAL_MS);

  // Also run immediately on startup
  processNextJob();
}

module.exports = { startJobManager };
