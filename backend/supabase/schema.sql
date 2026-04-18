-- ============================================================
-- Repository Architecture Navigator — Supabase Schema
-- Run this entire script in:
--   Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists pg_trgm;

-- ─── Table: jobs ─────────────────────────────────────────────────────────────
-- Tracks background analysis jobs. Supabase Realtime is enabled on this table.
create table if not exists public.jobs (
  id              uuid primary key default uuid_generate_v4(),
  repo_url        text not null,
  branch          text not null default 'HEAD',
  task_description text,
  status          text not null default 'pending'
                  check (status in ('pending','running','done','error')),
  stage           integer not null default 0,         -- 0-4 pipeline stage
  progress        integer not null default 0,         -- 0-100 percent
  error_message   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists jobs_touch on public.jobs;
create trigger jobs_touch
  before update on public.jobs
  for each row execute procedure public.touch_updated_at();

-- Enable Realtime on jobs table so the frontend gets push updates instantly
alter publication supabase_realtime add table public.jobs;

-- ─── Table: repos ────────────────────────────────────────────────────────────
create table if not exists public.repos (
  id              uuid primary key default uuid_generate_v4(),
  job_id          uuid references public.jobs(id) on delete cascade,
  repo_url        text not null,
  repo_name       text not null,
  branch          text not null default 'main',
  commit_sha      text not null,
  graph_json      jsonb,                              -- React Flow {nodes[], edges[]}
  file_tree       jsonb,
  onboarding_path jsonb,
  language_stats  jsonb,
  total_files     integer default 0,
  analyzed_files  integer default 0,
  created_at      timestamptz not null default now()
);

-- Cache key: same repo + branch + commit SHA = skip re-analysis
create index if not exists repos_cache_key_idx on public.repos (repo_url, branch, commit_sha);

-- ─── Table: files ────────────────────────────────────────────────────────────
create table if not exists public.files (
  id              uuid primary key default uuid_generate_v4(),
  repo_id         uuid references public.repos(id) on delete cascade,
  file_path       text not null,
  language        text,
  size_bytes      integer default 0,
  fan_in          integer default 0,                  -- # files that import this file
  fan_out         integer default 0,                  -- # files this file imports
  importance      integer default 0,                  -- (fan_in * 3) + fan_out
  is_entry_point  boolean default false,
  summary         text,
  exports         jsonb default '[]'::jsonb,
  imports         jsonb default '[]'::jsonb,
  issues          text[] default '{}',
  search_vector   tsvector,
  created_at      timestamptz not null default now()
);

create index if not exists files_repo_id_idx on public.files (repo_id);
create index if not exists files_importance_idx on public.files (repo_id, importance desc);
create index if not exists files_search_idx on public.files using gin(search_vector);

-- Auto-update search_vector on insert/update
create or replace function public.files_search_vector_update()
returns trigger language plpgsql as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.file_path, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(new.issues, ' '), '')), 'C');
  return new;
end;
$$;

drop trigger if exists files_search_vector_trigger on public.files;
create trigger files_search_vector_trigger
  before insert or update of file_path, summary, issues on public.files
  for each row execute procedure public.files_search_vector_update();

-- ─── Table: commits ──────────────────────────────────────────────────────────
create table if not exists public.commits (
  id              uuid primary key default uuid_generate_v4(),
  repo_id         uuid references public.repos(id) on delete cascade,
  commit_hash     text not null,
  message         text,
  author          text,
  authored_at     timestamptz,
  branch          text,
  issue_refs      text[] default '{}',               -- ['#123', 'JIRA-456']
  files_touched   text[] default '{}',
  created_at      timestamptz not null default now()
);

create index if not exists commits_repo_id_idx on public.commits (repo_id);
create index if not exists commits_branch_idx on public.commits (repo_id, branch);

-- ─── Function: claim_next_job ─────────────────────────────────────────────────
-- Atomically claims the next pending job — no Redis needed.
-- Uses FOR UPDATE SKIP LOCKED to prevent race conditions.
create or replace function public.claim_next_job()
returns public.jobs language sql as $$
  update public.jobs
  set status = 'running', updated_at = now()
  where id = (
    select id from public.jobs
    where status = 'pending'
    order by created_at asc
    limit 1
    for update skip locked
  )
  returning *;
$$;

-- ─── RPC: search_files ───────────────────────────────────────────────────────
-- Full-text search used by POST /api/repo/:id/query
create or replace function public.search_files(p_repo_id uuid, p_query text)
returns table (
  id          uuid,
  file_path   text,
  language    text,
  importance  integer,
  summary     text,
  headline    text,
  rank        float4
) language sql stable as $$
  select
    f.id,
    f.file_path,
    f.language,
    f.importance,
    f.summary,
    ts_headline(
      'english',
      coalesce(f.summary, f.file_path, ''),
      websearch_to_tsquery('english', p_query),
      'MaxFragments=1, MaxWords=15, MinWords=5, StartSel="<b>", StopSel="</b>"'
    ) as headline,
    ts_rank(f.search_vector, websearch_to_tsquery('english', p_query)) as rank
  from public.files f
  where f.repo_id = p_repo_id
    and f.search_vector @@ websearch_to_tsquery('english', p_query)
  order by rank desc
  limit 10;
$$;
