import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

let client: SupabaseClient | null = null;

export function getSupabaseConfigError(): string | null {
  if (!process.env.SUPABASE_URL) {
    return 'Missing env var: SUPABASE_URL';
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return 'Missing env var: SUPABASE_SERVICE_ROLE_KEY';
  }
  return null;
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfigError() === null;
}

function createSupabaseAdmin(): SupabaseClient {
  const configError = getSupabaseConfigError();
  if (configError) {
    throw new Error(configError);
  }

  console.log('Backend Supabase URL: Found');

  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!client) {
    client = createSupabaseAdmin();
  }
  return client;
}

/** Lazy proxy — avoids crashing at import when env vars are missing in Coolify/Docker. */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const instance = getSupabaseAdmin();
    const value = Reflect.get(instance, prop, receiver) as unknown;
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(instance)
      : value;
  },
});
