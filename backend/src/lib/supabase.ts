import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

const result = dotenv.config();

if (result.error) {
  console.error('Dotenv error:', result.error);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Backend loaded Supabase URL:', supabaseUrl ? 'Found' : 'Missing');

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase env vars in backend');
}

// Service role client bypasses RLS for webhook ingestion
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
