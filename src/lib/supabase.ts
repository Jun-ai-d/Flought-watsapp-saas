import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import { getSupabaseAnonKey, getSupabaseUrl, isFrontendConfigured } from './env';

export const isSupabaseConfigured = isFrontendConfigured;

export const supabase: SupabaseClient<Database> | null = isFrontendConfigured
  ? createClient<Database>(getSupabaseUrl(), getSupabaseAnonKey())
  : null;

export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }
  return supabase;
}
