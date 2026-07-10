import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment from the root .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

const dbUrl = process.env.DATABASE_URL;

async function runMissingDDL() {
  const client = new Client({
    connectionString: dbUrl,
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    // 1. Add webhook_secret_encrypted to developer_settings
    console.log('Adding webhook_secret_encrypted...');
    await client.query(`
      ALTER TABLE public.developer_settings 
      ADD COLUMN IF NOT EXISTS webhook_secret_encrypted text;
    `);

    // 2. Create shopify_settings table (and read it directly from the SQL file)
    console.log('Creating shopify_settings...');
    await client.query('CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;');
    const shopifySql = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20260715000099_shopify_settings.sql'), 'utf-8');
    await client.query(shopifySql);

    // 3. Reload cache
    console.log('Reloading schema cache...');
    await client.query("NOTIFY pgrst, 'reload schema'");

    console.log('Done fixing schema!');

  } catch (error) {
    console.error('Database connection error:', error);
  } finally {
    await client.end();
  }
}

runMissingDDL();
