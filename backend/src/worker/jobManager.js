/**
 * jobManager.js — Polls Supabase for pending jobs and spawns worker threads.
 * Uses claim_next_job() SQL function (FOR UPDATE SKIP LOCKED) as an atomic job queue.
 */

import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import supabase from '../services/supabase.js';
import jobEvents from '../services/events.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POLL_INTERVAL_MS = 2000;
const MAX_CONCURRENT = 2;

let activeWorkers = 0;

// Update to use pipeline.js as the worker entry point
const WORKER_PATH = path.resolve(__dirname, 'pipeline.js');

async function processNextJob() {
  if (activeWorkers >= MAX_CONCURRENT) return;

  try {
    const { data: result, error } = await supabase.rpc('claim_next_job');

    if (error) {
      logger.error('[JobManager] claim_next_job error details:', error);
      return;
    }

    if (!result || (Array.isArray(result) && result.length === 0)) return;
    const job = Array.isArray(result) ? result[0] : result;
    
    if (!job || !job.id) return;

    logger.info(`[JobManager] Starting job ${job.id} for ${job.repo_url}`);
    activeWorkers++;

    const worker = new Worker(WORKER_PATH, {
      workerData: {
        jobId: job.id,
        repoUrl: job.repo_url,
        branch: job.branch || 'HEAD',
        taskDescription: job.task_description || '',
      },
    });

    worker.on('message', (msg) => {
      if (msg.type === 'progress') {
        logger.info(`[JobManager] Progress update for ${job.id}: Stage ${msg.data.stage} (${msg.data.progress}%)`);
        jobEvents.emit('job_update', msg.data);
      }
    });

    worker.on('error', (err) => {
      logger.error(`[JobManager] Worker error for job ${job.id}:`, err);
      activeWorkers--;
      jobEvents.emit('job_update', { 
        id: job.id, 
        status: 'error', 
        error_message: err.message,
        updated_at: new Date().toISOString() 
      });
    });

    worker.on('exit', (code) => {
      logger.info(`[JobManager] Worker for job ${job.id} exited with code ${code}`);
      activeWorkers--;
    });

  } catch (err) {
    logger.error('[JobManager] Unexpected error:', err.message);
  }
}

export function startJobManager() {
  logger.info(`[JobManager] Started — polling every ${POLL_INTERVAL_MS} ms`);
  setInterval(processNextJob, POLL_INTERVAL_MS);
  processNextJob();
}
