export interface FileNodeData {
  id: string;
  path: string;
  name: string;
  language: string;
  fan_in: number;
  fan_out: number;
  composite_importance: number;
  is_entry_point: boolean;
  last_commit_sha: string;
  realId?: string;
}


export interface DependencyEdgeData {
  source: string;
  target: string;
  import_type: 'static' | 'dynamic' | 'reexport';
}

export interface GraphData {
  nodes: FileNodeData[];
  edges: DependencyEdgeData[];
  insights?: string;
  metadata: {
    repo_url: string;
    repo_id?: string;
    total_files: number;
    analyzed_files: number;
    scan_depth: number;
  };
}

export type NodeImportance = 'high' | 'medium' | 'low';

export function getImportanceLevel(score: number): NodeImportance {
  if (score >= 20) return 'high';
  if (score >= 8) return 'medium';
  return 'low';
}
