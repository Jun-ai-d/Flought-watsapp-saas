import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment from the root .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('FATAL: DATABASE_URL is not set in .env');
  process.exit(1);
}

const migrationsDir = path.join(__dirname, '../../supabase/migrations');

async function syncMigrations() {
  const client = new Client({
    connectionString: dbUrl,
  });

  try {
    await client.connect();
    console.log('Connected to remote database.');

    // Ensure the schema_migrations table exists (Supabase standard)
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS supabase_migrations;
      CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
        version character varying(14) NOT NULL,
        name character varying(255) NOT NULL,
        statements text[],
        PRIMARY KEY (version)
      );
    `);

    // Get applied migrations
    const res = await client.query('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version ASC');
    const appliedVersions = new Set(res.rows.map(row => row.version));
    
    console.log(`Found ${appliedVersions.size} applied migrations in database.`);

    // Read all local migration files
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // sort alphabetically ensures chronological order by timestamp

    let appliedCount = 0;

    for (const file of files) {
      // The version is the first 14 characters of the filename (YYYYMMDDHHMMSS)
      const version = file.substring(0, 14);
      
      if (!appliedVersions.has(version)) {
        console.log(`Applying missing migration: ${file}...`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        
        try {
          // Execute the migration
          await client.query('BEGIN');
          await client.query(sql);
          // Record it as applied
          await client.query(
            'INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ($1, $2)',
            [version, file.substring(15).replace('.sql', '')]
          );
          await client.query('COMMIT');
          appliedCount++;
          console.log(`Successfully applied ${file}.`);
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`ERROR applying ${file}:`, err);
          console.error('Migration halted.');
          break;
        }
      }
    }

    console.log(`Applied ${appliedCount} missing migrations. Reloading schema cache...`);
    await client.query("NOTIFY pgrst, 'reload schema'");
    console.log('Schema cache reloaded!');

  } catch (error) {
    console.error('Database connection error:', error);
  } finally {
    await client.end();
  }
}

syncMigrations();
