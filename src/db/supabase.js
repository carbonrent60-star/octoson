import { createClient } from '@supabase/supabase-js';
import { requiredEnv } from '../env.js';
import { isAutomatedTestRun, isMemoryStorageEnabled } from './helpers.js';

let cachedClient = null;

export function useSupabaseStorage() {
  return !isMemoryStorageEnabled();
}

export function getSupabaseClient() {
  if (!useSupabaseStorage()) {
    return null;
  }

  if (isAutomatedTestRun() && process.env.OCTOSON_ALLOW_LIVE_SUPABASE_TESTS !== 'true') {
    throw new Error('Automated tests must use memory storage and cannot connect to Supabase.');
  }

  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const supabaseServiceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      },
      global: {
        headers: {
          'X-Client-Info': 'octoson-bot'
        }
      }
    });
  }

  return cachedClient;
}

export async function ensureSupabaseHealth() {
  if (!useSupabaseStorage()) {
    return { ok: true, storage: 'memory' };
  }

  const client = getSupabaseClient();

  for (const table of ['economy_settings', 'parties']) {
    const { error } = await client.from(table).select('id').limit(1);

    if (error) {
      const wrapped = new Error(`Supabase health check failed for ${table}: ${error.message}`);
      wrapped.code = error.code;
      wrapped.details = error.details;
      wrapped.hint = error.hint;
      wrapped.table = table;
      throw wrapped;
    }
  }

  return { ok: true, storage: 'supabase' };
}
