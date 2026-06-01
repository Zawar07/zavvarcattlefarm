import { readFileSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';
import { Pool } from 'pg';

config({ path: resolve(__dirname, '../.env') });

/** Supabase TLS from local Windows dev (not needed on Vercel). */
if (process.env.ALLOW_INSECURE_DB_TLS === '1') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

async function migrate() {
  const connectionString =
    process.env.DATABASE_URL_MIGRATE ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('Set DATABASE_URL or POSTGRES_URL_NON_POOLING in .env');
  }

  const sql = readFileSync(
    resolve(__dirname, '../supabase/migrations/001_schema.sql'),
    'utf8',
  );

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false } as { rejectUnauthorized: boolean },
  });

  const client = await pool.connect();
  try {
    console.log('Running migration 001_schema.sql...');
    await client.query(sql);
    console.log('Migration complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
