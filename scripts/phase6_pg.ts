import { Client } from 'pg';
import 'dotenv/config';

async function migrate() {
  console.log('Running Phase 6 Migrations directly via pg...');
  
  if (!process.env.DATABASE_URL) {
    console.error('Missing DATABASE_URL in .env');
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to DB');

    await client.query(`
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS handover_reason text;
    `);

    console.log('Successfully added handover_reason column to conversations table!');
  } catch (err) {
    console.error('Error running migration:', err);
  } finally {
    await client.end();
  }
}

migrate();
