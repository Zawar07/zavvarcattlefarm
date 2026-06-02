import { config } from 'dotenv';
import { resolve } from 'path';
import { Pool } from 'pg';

config({ path: resolve(__dirname, '../.env') });

if (process.env.ALLOW_INSECURE_DB_TLS === '1') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

async function backfill() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } as { rejectUnauthorized: boolean },
  });

  const client = await pool.connect();
  try {
    // Default: all expenses with Feed category → is_animal_cost = true (already default)
    // Farm Handover (sub_category = 'Farm Handover') → is_animal_cost = false
    const { rowCount: farmHandover } = await client.query(
      `UPDATE expenses SET is_animal_cost = FALSE
       WHERE sub_category ILIKE '%Farm Handover%' AND deleted_at IS NULL`,
    );
    console.log(`✓ Farm Handover → Farm cost: ${farmHandover} row(s) updated`);

    // Food (sub_category = 'Food', category = Feed) → is_animal_cost = true (ensure)
    const { rowCount: food } = await client.query(
      `UPDATE expenses SET is_animal_cost = TRUE
       WHERE sub_category ILIKE '%Food%'
         AND category_id = (SELECT id FROM expense_categories WHERE name = 'Feed' LIMIT 1)
         AND deleted_at IS NULL`,
    );
    console.log(`✓ Food (Feed) → Animal cost: ${food} row(s) updated`);

    // Everything else that is NOT Feed category → is_animal_cost = false
    const { rowCount: others } = await client.query(
      `UPDATE expenses SET is_animal_cost = FALSE
       WHERE category_id != (SELECT id FROM expense_categories WHERE name = 'Feed' LIMIT 1)
         AND sub_category NOT ILIKE '%Food%'
         AND deleted_at IS NULL`,
    );
    console.log(`✓ Non-Feed expenses → Farm cost: ${others} row(s) updated`);

  } finally {
    client.release();
    await pool.end();
  }
}

backfill().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
