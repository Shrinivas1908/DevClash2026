import type { GraphData } from './graph';

export type PipelineStageNumber = 1 | 2 | 3 | 4;
export type StageStatus = 'waiting' | 'running' | 'complete' | 'failed';
export type JobStatus = 'pending' | 'processing' | 'complete' | 'failed';

export interface PipelineStage {
  stage: PipelineStageNumber;
  name: string;
  status: StageStatus;
  started_at: string | null;
  completed_at: string | null;
}

export interface Job {
  id: string;
  repo_url: string;
  status: JobStatus;
  stages: PipelineStage[];
  graph_json: GraphData | null;
  created_at: string;
  error_message?: string;
}

export type JobCreateResponse = {
  jobId: string;
};

export const STAGE_NAMES: Record<PipelineStageNumber, string> = {
  1: 'Repo Ingestion',
  2: 'Static Analysis',
  3: 'Commit Analysis',
  4: 'AI Summaries',
};

export const DEFAULT_STAGES: PipelineStage[] = [1, 2, 3, 4].map((n) => ({
  stage: n as PipelineStageNumber,
  name: STAGE_NAMES[n as PipelineStageNumber],
  status: 'waiting',
  started_at: null,
  completed_at: null,
}));
