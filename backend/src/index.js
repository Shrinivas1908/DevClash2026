/**
 * index.js — Main Express server entry point.
 * Repository Architecture Navigator — Backend
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const os = require('os');

const apiRouter = require('./routes/api');
const { startJobManager } = require('./worker/jobManager');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Ensure temp clone directory exists ──────────────────────────────────────
const cloneBaseDir = process.env.CLONE_BASE_DIR
  ? path.resolve(process.env.CLONE_BASE_DIR)
  : path.join(os.tmpdir(), 'ran-repos');

if (!fs.existsSync(cloneBaseDir)) {
  fs.mkdirSync(cloneBaseDir, { recursive: true });
}



// ─── Middleware ───────────────────────────────────────────────────────────────

// Security headers
app.use(helmet({
  crossOriginEmbedderPolicy: false,
}));

// CORS — allow the Vite dev server and production frontend
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5174',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some((o) => origin.startsWith(o))) return callback(null, true);
    return callback(null, true); // In dev mode allow all — tighten in production
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Request logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting — protect against abuse
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,             // 60 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});
app.use('/api/', apiLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api', apiRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀 RAN Backend running on http://localhost:${PORT}`);
  console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Supabase    : ${process.env.SUPABASE_URL ? '✅ configured' : '❌ MISSING'}`);
  console.log(`   Firebase    : ${process.env.FIREBASE_PROJECT_ID ? '✅ configured' : '⚠️  disabled (optional)'}`);
  console.log(`   Gemini      : ${process.env.GEMINI_API_KEY ? '✅ configured' : '❌ MISSING'}`);
  console.log(`   GitHub      : ${process.env.GITHUB_TOKEN ? '✅ configured' : '⚠️  unauthenticated (rate limited)'}`);
  console.log(`   Clone dir   : ${cloneBaseDir}\n`);

  // Start background job processor
  startJobManager();
});

module.exports = app;
