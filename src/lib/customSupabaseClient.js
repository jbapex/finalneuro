import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não definidos no .env');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

/**
 * RPC devolveu 404 / PGRST202 — a função não está exposta pelo PostgREST (não existe na BD
 * desse projeto ou o schema cache do REST não foi recarregado após o CREATE FUNCTION).
 */
export function isPostgrestRpcNotFoundError(error) {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '').toLowerCase();
  const hint = String(error.hint || '').toLowerCase();
  return (
    code === 'PGRST202' ||
    hint.includes('reload') ||
    (msg.includes('could not find') && msg.includes('function')) ||
    msg.includes('schema cache')
  );
}
