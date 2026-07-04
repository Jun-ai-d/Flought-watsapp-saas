import { supabaseAdmin } from '../backend/src/lib/supabase';

async function migrate() {
  console.log('Running Phase 6 Migrations...');
  
  const { error } = await supabaseAdmin.rpc('run_sql', {
    sql_query: `
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS handover_reason text;
    `
  });

  if (error) {
    // If run_sql is not available, we have to create it or just print instructions.
    console.error('Failed to run migration via RPC. Make sure run_sql exists or run this manually in Supabase SQL editor:');
    console.error('ALTER TABLE conversations ADD COLUMN IF NOT EXISTS handover_reason text;');
  } else {
    console.log('Successfully added handover_reason column to conversations table!');
  }
}

migrate();
