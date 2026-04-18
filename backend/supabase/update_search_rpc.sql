-- ================================================================
-- REQUIRED: Run this in Supabase Dashboard → SQL Editor → Run
-- This updates the search_files RPC to return ts_headline snippets
-- which the frontend SearchResults component needs for highlighted
-- text in search results.
-- ================================================================

CREATE OR REPLACE FUNCTION public.search_files(p_repo_id uuid, p_query text)
RETURNS TABLE (
  id          uuid,
  file_path   text,
  language    text,
  importance  integer,
  summary     text,
  headline    text,
  rank        float4
) LANGUAGE sql STABLE AS $$
  SELECT
    f.id,
    f.file_path,
    f.language,
    f.importance,
    f.summary,
    ts_headline(
      'english',
      COALESCE(f.summary, f.file_path, ''),
      websearch_to_tsquery('english', p_query),
      'MaxFragments=1, MaxWords=15, MinWords=5, StartSel="<b>", StopSel="</b>"'
    ) AS headline,
    ts_rank(f.search_vector, websearch_to_tsquery('english', p_query)) AS rank
  FROM public.files f
  WHERE f.repo_id = p_repo_id
    AND f.search_vector @@ websearch_to_tsquery('english', p_query)
  ORDER BY rank DESC
  LIMIT 10;
$$;
