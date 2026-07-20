import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// M-11 Fix: removed VITE_SUPABASE_URL fallback — VITE_ prefix is a client-side Vite convention
// and should never be used in a Node.js backend. Always use SUPABASE_URL here.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing env var: SUPABASE_URL');
}

if (!supabaseServiceKey) {
  throw new Error('Missing env var: SUPABASE_SERVICE_ROLE_KEY');
}

console.log('Backend Supabase URL:', supabaseUrl ? 'Found' : 'Missing');

// Service role client — bypasses RLS for server-side writes.
// NEVER expose this client or its key to frontend code.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
