export interface SearchResult {
  file_id: string;
  path: string;
  rank: number;
  headline: string;
  importance: number;
}

export interface SearchQuery {
  q: string;
  jobId: string;
}
