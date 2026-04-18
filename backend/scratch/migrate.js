import supabase from '../src/services/supabase.js';

async function migrate() {
  console.log('Running migration: Add ai_context to repos table...');
  
  // Note: Supabase JS client doesn't support direct DDL like ALTER TABLE easily
  // unless you use the RPC approach or the user runs it in the dashboard.
  // However, we can try to use the 'query' RPC if it exists, or just tell the user.
  
  console.log('IMPORTANT: Please run the following SQL in your Supabase SQL Editor:');
  console.log('ALTER TABLE public.repos ADD COLUMN IF NOT EXISTS ai_context jsonb;');
}

migrate();
