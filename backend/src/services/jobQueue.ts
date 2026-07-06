import { PgBoss } from 'pg-boss';
import path from 'path';
import dotenv from 'dotenv';

// Ensure env is loaded since jobQueue might be initialized early
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error('DATABASE_URL is missing in environment variables');
}

export const boss = new PgBoss(dbUrl);

boss.on('error', error => {
  console.error('pg-boss error:', { error });
});

export const initJobQueue = async () => {
  try {
    await boss.start();
    console.log('pg-boss initialized and started successfully');
  } catch (error) {
    console.error('Failed to start pg-boss', { error });
    throw error;
  }
};
