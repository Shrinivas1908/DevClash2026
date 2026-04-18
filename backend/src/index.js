/**
 * index.js — Main Express server entry point (ES Module).
 */

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

import apiRouter from './routes/api.js';
import filesRouter from './routes/files.js';
import { startJobManager } from './worker/jobManager.js';
import logger from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure temp clone directory exists
const cloneBaseDir = process.env.CLONE_BASE_DIR
  ? path.resolve(process.env.CLONE_BASE_DIR)
  : path.join(os.tmpdir(), 'ran-repos');

if (!fs.existsSync(cloneBaseDir)) {
  fs.mkdirSync(cloneBaseDir, { recursive: true });
}

// Middleware
app.use(helmet({ crossOriginEmbedderPolicy: false }));

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5174',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.some((o) => origin.startsWith(o))) {
      return callback(null, true);
    }
    return callback(null, true); // Dev mode
  },
  credentials: true,
}));

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', apiRouter);
app.use('/api/files', filesRouter); // Mount the new files summary route

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Error handling
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

app.use((err, req, res, _next) => {
  logger.error('[Server] Unhandled error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

import supabase from './services/supabase.js';

// Auto-cleanup background task (runs every 15 minutes)
setInterval(async () => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    // Deleting jobs cascades to repos, files, and commits
    const { data, error } = await supabase
      .from('jobs')
      .delete()
      .lt('created_at', oneHourAgo)
      .select('id');

    if (error) {
      logger.error('Failed to run auto-cleanup:', error.message);
    } else if (data && data.length > 0) {
      logger.info(`🧹 Auto-cleanup: Deleted ${data.length} jobs (and associated repos/files) older than 1 hour.`);
    }
  } catch (err) {
    logger.error('Error during auto-cleanup:', err);
  }
}, 15 * 60 * 1000);

// Start
app.listen(PORT, () => {
  logger.info(`🚀 RAN Backend running on http://localhost:${PORT}`);
  startJobManager();
});

export default app;
