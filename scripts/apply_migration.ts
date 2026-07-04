import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Missing DATABASE_URL in .env');
  process.exit(1);
}

const sql = fs.readFileSync(path.join(process.cwd(), 'supabase', 'migrations', '20260704000004_review_fixes.sql'), 'utf-8');

async function main() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to DB');
    await client.query(sql);
    console.log('✅ Applied 20260704000004_review_fixes.sql');
  } catch (error) {
    console.error('❌ Error applying migration:', error);
  } finally {
    await client.end();
  }
}

main();
