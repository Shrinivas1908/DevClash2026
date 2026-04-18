import type { FileNodeData, GraphData } from '@/types/graph';
import type { Job } from '@/types/job';
import type { SearchResult } from '@/types/search';

// ─── Mock Graph Data ────────────────────────────────────────────────────────

export const MOCK_FILES: FileNodeData[] = [
  { id: 'f1', path: 'src/main.ts', name: 'main.ts', language: 'typescript', fan_in: 0, fan_out: 5, composite_importance: 5, is_entry_point: true, last_commit_sha: 'a1b2c3d' },
  { id: 'f2', path: 'src/app.ts', name: 'app.ts', language: 'typescript', fan_in: 8, fan_out: 4, composite_importance: 28, is_entry_point: false, last_commit_sha: 'b2c3d4e' },
  { id: 'f3', path: 'src/controllers/userController.ts', name: 'userController.ts', language: 'typescript', fan_in: 6, fan_out: 3, composite_importance: 21, is_entry_point: false, last_commit_sha: 'c3d4e5f' },
  { id: 'f4', path: 'src/controllers/authController.ts', name: 'authController.ts', language: 'typescript', fan_in: 5, fan_out: 2, composite_importance: 17, is_entry_point: false, last_commit_sha: 'd4e5f6a' },
  { id: 'f5', path: 'src/services/userService.ts', name: 'userService.ts', language: 'typescript', fan_in: 4, fan_out: 3, composite_importance: 15, is_entry_point: false, last_commit_sha: 'e5f6a7b' },
  { id: 'f6', path: 'src/services/authService.ts', name: 'authService.ts', language: 'typescript', fan_in: 3, fan_out: 2, composite_importance: 11, is_entry_point: false, last_commit_sha: 'f6a7b8c' },
  { id: 'f7', path: 'src/models/user.ts', name: 'user.ts', language: 'typescript', fan_in: 7, fan_out: 1, composite_importance: 22, is_entry_point: false, last_commit_sha: 'a7b8c9d' },
  { id: 'f8', path: 'src/models/session.ts', name: 'session.ts', language: 'typescript', fan_in: 4, fan_out: 1, composite_importance: 13, is_entry_point: false, last_commit_sha: 'b8c9d0e' },
  { id: 'f9', path: 'src/utils/logger.ts', name: 'logger.ts', language: 'typescript', fan_in: 9, fan_out: 0, composite_importance: 27, is_entry_point: false, last_commit_sha: 'c9d0e1f' },
  { id: 'f10', path: 'src/utils/validation.ts', name: 'validation.ts', language: 'typescript', fan_in: 5, fan_out: 1, composite_importance: 16, is_entry_point: false, last_commit_sha: 'd0e1f2a' },
  { id: 'f11', path: 'src/config/database.ts', name: 'database.ts', language: 'typescript', fan_in: 6, fan_out: 0, composite_importance: 18, is_entry_point: false, last_commit_sha: 'e1f2a3b' },
  { id: 'f12', path: 'src/config/env.ts', name: 'env.ts', language: 'typescript', fan_in: 8, fan_out: 0, composite_importance: 24, is_entry_point: false, last_commit_sha: 'f2a3b4c' },
  { id: 'f13', path: 'src/middleware/auth.ts', name: 'auth.ts', language: 'typescript', fan_in: 3, fan_out: 2, composite_importance: 11, is_entry_point: false, last_commit_sha: 'a3b4c5d' },
  { id: 'f14', path: 'src/middleware/error.ts', name: 'error.ts', language: 'typescript', fan_in: 4, fan_out: 1, composite_importance: 13, is_entry_point: false, last_commit_sha: 'b4c5d6e' },
  { id: 'f15', path: 'src/routes/index.ts', name: 'index.ts', language: 'typescript', fan_in: 2, fan_out: 4, composite_importance: 10, is_entry_point: false, last_commit_sha: 'c5d6e7f' },
];

export const MOCK_GRAPH_DATA: GraphData = {
  nodes: MOCK_FILES,
  edges: [
    { source: 'f1', target: 'f2', import_type: 'static' },
    { source: 'f2', target: 'f3', import_type: 'static' },
    { source: 'f2', target: 'f4', import_type: 'static' },
    { source: 'f2', target: 'f15', import_type: 'static' },
    { source: 'f3', target: 'f5', import_type: 'static' },
    { source: 'f3', target: 'f9', import_type: 'static' },
    { source: 'f4', target: 'f6', import_type: 'static' },
    { source: 'f5', target: 'f7', import_type: 'static' },
    { source: 'f5', target: 'f11', import_type: 'static' },
    { source: 'f6', target: 'f7', import_type: 'static' },
    { source: 'f6', target: 'f8', import_type: 'static' },
    { source: 'f7', target: 'f9', import_type: 'static' },
    { source: 'f10', target: 'f9', import_type: 'static' },
    { source: 'f11', target: 'f12', import_type: 'static' },
    { source: 'f13', target: 'f6', import_type: 'static' },
    { source: 'f14', target: 'f9', import_type: 'static' },
    { source: 'f15', target: 'f3', import_type: 'static' },
    { source: 'f15', target: 'f4', import_type: 'static' },
    { source: 'f1', target: 'f9', import_type: 'dynamic' },
    { source: 'f2', target: 'f12', import_type: 'static' },
  ],
  metadata: {
    repo_url: 'https://github.com/demo/example-api',
    total_files: 15,
    analyzed_files: 15,
    scan_depth: 3,
  },
};

export const MOCK_JOB: Job = {
  id: 'mock-job-001',
  repo_url: 'https://github.com/demo/example-api',
  status: 'complete',
  stages: [
    { stage: 1, name: 'Repo Ingestion', status: 'complete', started_at: new Date(Date.now() - 10000).toISOString(), completed_at: new Date(Date.now() - 8000).toISOString() },
    { stage: 2, name: 'Static Analysis', status: 'complete', started_at: new Date(Date.now() - 8000).toISOString(), completed_at: new Date(Date.now() - 5000).toISOString() },
    { stage: 3, name: 'Commit Analysis', status: 'complete', started_at: new Date(Date.now() - 5000).toISOString(), completed_at: new Date(Date.now() - 3000).toISOString() },
    { stage: 4, name: 'AI Summaries', status: 'complete', started_at: new Date(Date.now() - 3000).toISOString(), completed_at: new Date(Date.now() - 500).toISOString() },
  ],
  graph_json: MOCK_GRAPH_DATA,
  created_at: new Date(Date.now() - 15000).toISOString(),
};

export const MOCK_SEARCH_RESULTS: SearchResult[] = [
  { file_id: 'f9', path: 'src/utils/logger.ts', rank: 0.95, headline: 'Centralized <b>logging</b> utility used across all modules', importance: 27 },
  { file_id: 'f2', path: 'src/app.ts', rank: 0.87, headline: 'Main <b>application</b> bootstrap and middleware setup', importance: 28 },
  { file_id: 'f7', path: 'src/models/user.ts', rank: 0.75, headline: 'User <b>model</b> definition with schema and validators', importance: 22 },
];

export const MOCK_AI_SUMMARY = `This file serves as the centralized logging infrastructure for the entire application. It exports a configured Winston logger instance with multiple transports (console and file-based) and provides structured log formatting with timestamps.

**Key Exports:**
- \`logger\` — singleton Winston logger
- \`createChildLogger(module)\` — creates module-scoped child loggers

**Architectural Role:**
High fan-in utility (9 importers) making this a critical cross-cutting concern. Changes to this file propagate across the entire codebase. Zero fan-out dependencies indicate a pure utility leaf node.`;

export const IS_MOCK_MODE = false; // Set to true to use mock data without a backend

// ─── AI & Task Demo Data ───────────────────────────────────────────────────

export const MOCK_TASK_MAP: Record<string, string[]> = {
  auth: ['f4', 'f6', 'f8', 'f13'],
  user: ['f3', 'f5', 'f7'],
  logging: ['f9'],
  database: ['f11', 'f12'],
  api: ['f2', 'f15', 'f3', 'f4'],
  config: ['f11', 'f12', 'f13'],
};

export const MOCK_AI_ANSWERS: Record<string, string> = {
  'where is auth handled': 'Authentication is handled primarily in `src/middleware/auth.ts` (f13) for request validation, and `src/controllers/authController.ts` (f4) for business logic. Session management logic is in `src/models/session.ts` (f8).',
  'how is the database configured': 'The database configuration is managed in `src/config/database.ts` (f11), which reads environment variables from `src/config/env.ts` (f12).',
  'where should i add a new feature': 'Start by defining a new route in `src/routes/index.ts` (f15), then implement a controller in `src/controllers/` and a service in `src/services/` if business logic is complex.',
  'default': "That's a great question about the architecture. I've analyzed the topology and it looks like you're asking about a core module. I recommend looking at the high-importance files highlighted in the graph.",
};

export function askAiMock(query: string): string {
  const normalized = query.toLowerCase();
  for (const [key, answer] of Object.entries(MOCK_AI_ANSWERS)) {
    if (normalized.includes(key)) return answer;
  }
  return MOCK_AI_ANSWERS.default;
}
