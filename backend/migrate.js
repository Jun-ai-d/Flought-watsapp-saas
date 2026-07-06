const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  connectionString: 'postgresql://postgres:postgres@localhost:54322/postgres'
});

async function run() {
  await client.connect();
  const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20260715000015_platform_expenses.sql'), 'utf-8');
  await client.query(sql);
  await client.end();
  console.log('Migration applied successfully');
}

run().catch(console.error);
