# RAN Backend — Setup Guide

Repository Architecture Navigator · Node.js + Express Backend

---

## Quick Start (3 Steps)

```bash
cd backend
cp .env.example .env   # then fill in your keys (see below)
npm install
npm run dev
```

Server starts at **http://localhost:3001**

---

## Step 1 — Get Your API Keys

### 🔵 Supabase (Database + Realtime)
> Free tier: 500MB Postgres + Realtime + Storage

1. Go to **https://supabase.com** → Click **"Start your project"** → Sign up free
2. Click **"New project"** → Choose a name (e.g. `ran-db`) → Set a database password → Create
3. Wait ~2 minutes for the project to provision
4. Go to **Project Settings** (gear icon) → **API** tab
5. Copy these two values into your `.env`:
   ```
   SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co       ← "Project URL"
   SUPABASE_ANON_KEY=eyJ...                             ← "anon public" key
   SUPABASE_SERVICE_ROLE_KEY=eyJ...                     ← "service_role" key (keep secret!)
   ```

> ⚠️ **IMPORTANT**: The backend uses `SUPABASE_SERVICE_ROLE_KEY` (not the anon key) to bypass Row Level Security. Never expose this key on the frontend.

---

### 🟠 Run the Database Schema

After creating your Supabase project:

1. In your Supabase dashboard, click **"SQL Editor"** in the left sidebar
2. Click **"New query"**
3. Open the file `backend/supabase/schema.sql` from this project
4. Copy **all** of its contents and paste into the SQL Editor
5. Click **"Run"** (or press `Ctrl+Enter`)
6. You should see: `Success. No rows returned`

This creates 4 tables (`jobs`, `repos`, `files`, `commits`), the `claim_next_job()` function, full-text search triggers, and enables Realtime on the `jobs` table.

---

### 🔑 GitHub Personal Access Token
> Free: 5,000 API requests/hour

1. Go to **https://github.com** → Click your profile picture → **Settings**
2. Scroll to the bottom → Click **"Developer settings"** (left sidebar)
3. Click **"Personal access tokens"** → **"Tokens (classic)"**
4. Click **"Generate new token (classic)"**
5. Set a name (e.g. `RAN Backend`), set expiration to `No expiration` (or 1 year)
6. Under **Scopes**, check only:
   - ✅ `public_repo` (to read public repositories)
   - ✅ `read:user` (optional, for user info)
7. Click **"Generate token"** → Copy the token immediately (you won't see it again!)
8. Paste into your `.env`:
   ```
   GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
   ```

> Without a token, GitHub limits you to 60 requests/hour. With a token: 5,000/hour.

---

### 🤖 Gemini AI API Key (Free)
> Free tier: 15 requests/minute, 1 million tokens/day

1. Go to **https://aistudio.google.com/app/apikey**
2. Sign in with your Google account
3. Click **"Create API key"** → Select **"Create API key in new project"**
4. Copy the generated key
5. Paste into your `.env`:
   ```
   GEMINI_API_KEY=AIzaSy_xxxxxxxxxxxxxxxxxxxx
   ```

> The backend rate-limits Gemini to 12 requests/minute automatically, staying safely within the free tier.

---

### 🔴 Firebase (Optional — Backup/Mirror)
> Free tier: 1GB Firestore + 10GB storage/month  
> ⚠️ Firebase is **optional**. If you skip it, the backend still works fully — only the backup mirror is disabled.

1. Go to **https://console.firebase.google.com** → Click **"Add project"**
2. Enter a project name (e.g. `ran-backup`) → Continue → Continue → Create
3. In the left sidebar → click the **gear icon** → **"Project settings"**
4. Click the **"Service accounts"** tab
5. Click **"Generate new private key"** → **"Generate key"**
6. A `.json` file will download. Open it and copy:
   - `"project_id"` → `FIREBASE_PROJECT_ID`
   - `"client_email"` → `FIREBASE_CLIENT_EMAIL`
   - `"private_key"` → `FIREBASE_PRIVATE_KEY` (the entire string including `-----BEGIN PRIVATE KEY-----`)
7. Paste into your `.env`:
   ```
   FIREBASE_PROJECT_ID=ran-backup-xxxxx
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@ran-backup.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n"
   ```

> **Important**: The private key contains newlines. When pasting into `.env`, keep the entire key in double quotes and replace actual newlines with `\n`.

Also enable Firestore:
1. In Firebase console → left sidebar → **"Firestore Database"**
2. Click **"Create database"** → **"Start in test mode"** → **"Next"** → Choose a region → **"Enable"**

---

## Step 2 — Configure `.env`

Copy the template and fill in your keys:

```bash
cp .env.example .env
```

Your `.env` should look like this when complete:

```env
PORT=3001
NODE_ENV=development

# Supabase
SUPABASE_URL=https://abcdefghijkl.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# GitHub
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# Gemini
GEMINI_API_KEY=AIzaSy_xxxxxxxxxxxxxxxxxxxx

# Firebase (optional)
FIREBASE_PROJECT_ID=ran-backup-xxxxx
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@ran-backup.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----\n"

# Frontend (for CORS)
FRONTEND_URL=http://localhost:5173

# Clone directory
CLONE_BASE_DIR=./tmp/repos
```

---

## Step 3 — Run the Backend

```bash
cd backend
npm install
npm run dev       # development with auto-restart
# OR
npm start         # production
```

You'll see:

```
🚀 RAN Backend running on http://localhost:3001
   Environment : development
   Supabase    : ✅ configured
   Firebase    : ✅ configured
   Gemini      : ✅ configured
   GitHub      : ✅ configured
   Clone dir   : /path/to/backend/tmp/repos
```

---

## Step 4 — Connect the Frontend

In the **frontend** folder (`DevClash2026-1/`), update `.env` (or create it from `.env.example`):

```env
VITE_API_BASE_URL=http://localhost:3001
VITE_SUPABASE_URL=https://abcdefghijkl.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Then in `src/lib/mockData.ts`, change line 86:
```ts
// BEFORE:
export const IS_MOCK_MODE = true;

// AFTER:
export const IS_MOCK_MODE = false;
```

Run the frontend:
```bash
cd ..   # back to DevClash2026-1
npm run dev
```

Open **http://localhost:5173** → Enter a GitHub repo URL → Click **Analyze Repository**.

---

## API Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/repo/analyze` | Submit repo for analysis → `{job_id}` |
| `POST` | `/api/jobs` | Alias for frontend compatibility |
| `GET` | `/api/jobs/:id` | Full job status (stages, progress) |
| `GET` | `/api/job/:id/status` | Lightweight polling fallback |
| `GET` | `/api/job/:id/repo` | Repo metadata after completion |
| `GET` | `/api/graph/:jobId` | React-Flow graph JSON for a job |
| `GET` | `/api/repo/:id/graph` | React-Flow graph JSON for a repo |
| `GET` | `/api/repo/:id/files` | Files ranked by importance (`?task=` `?issue=`) |
| `GET` | `/api/repo/:id/commits` | Commit history (`?issue=` `?branch=`) |
| `GET` | `/api/file/:id/summary` | AI summary + imports/exports for one file |
| `POST` | `/api/repo/:id/query` | Natural language search |
| `GET` | `/api/repo/:id/onboarding-path` | Ordered reading list for new devs |
| `GET` | `/api/repo/:id/branches` | Branch list with categories |
| `GET` | `/api/branches?repo_url=` | GitHub API branch list with categories |
| `GET` | `/health` | Server health check |

---

## Branch Categorization

Branches are automatically categorized:

| Category | Branch Patterns |
|----------|----------------|
| `production` | `main`, `master`, `trunk` |
| `release` | `release/*`, `hotfix/*` |
| `feature` | `feature/*`, `feat/*` |
| `bugfix` | `fix/*`, `bugfix/*`, `bug/*` |
| `maintenance` | `chore/*`, `refactor/*`, `ci/*` |
| `integration` | `dev`, `develop`, `development`, `staging` |
| `other` | everything else |

To analyze a specific branch, include `branch` in the analyze request:
```json
POST /api/repo/analyze
{
  "repo_url": "https://github.com/owner/repo",
  "branch": "feature/auth-refactor",
  "task_description": "Fix authentication flow"
}
```

---

## Architecture Overview

```
HTTP Request
    ↓
Express Router (/src/routes/api.js)
    ↓
POST /api/jobs → Supabase jobs table (status: pending)
    ↓
JobManager polls claim_next_job() every 2s
    ↓
Worker Thread spawned (worker_threads)
    ↓
Stage 1: simple-git shallow clone → file tree
Stage 2: @babel/parser + @typescript-eslint/parser → AST → graph
Stage 3: git log → commits + issue refs
Stage 4: Gemini 1.5 Flash batched summaries
    ↓
Supabase: repos + files + commits saved
Supabase: jobs.status = 'done' → Realtime push → Frontend updates
Firebase: async mirror (best-effort)
```

---

## Cost Summary (All Free)

| Service | Free Tier | Usage |
|---------|-----------|-------|
| Supabase | 500MB DB + Realtime | Jobs queue + graph storage |
| Firebase | 1GB Firestore | Backup mirror |
| Gemini 1.5 Flash | 15 req/min, 1M tokens/day | AI summaries |
| GitHub API | 5,000 req/hour | Branch list |
| Render/Railway | Free hosting | Backend deployment |

---

## Troubleshooting

**"SUPABASE_SERVICE_ROLE_KEY is not set"**
→ Make sure you copied the `service_role` key, not the `anon` key. They're both in Supabase → Project Settings → API.

**"Failed to clone repository"**
→ Make sure Git is installed: `git --version`. On Windows, install from https://git-scm.com

**Gemini returns "AI summary unavailable"**
→ Check your `GEMINI_API_KEY`. Make sure you're under 15 req/min (the backend rate-limits automatically).

**Jobs stuck in "pending"**
→ The job manager is polling. Check the backend logs. Make sure `claim_next_job` SQL function was created (run schema.sql again).

**CORS errors in browser**
→ Make sure `FRONTEND_URL=http://localhost:5173` is set in backend `.env`.
