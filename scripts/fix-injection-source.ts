import { config } from 'dotenv';
import { resolve } from 'path';
import { Pool } from 'pg';

config({ path: resolve(__dirname, '../.env') });

if (process.env.ALLOW_INSECURE_DB_TLS === '1') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

async function fix() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } as { rejectUnauthorized: boolean },
  });

  const client = await pool.connect();
  try {
    // Show all bank_balance_log entries so we can see what's there
    const { rows: all } = await client.query(
      `SELECT id, previous_amount, new_amount, changed_at, source
       FROM bank_balance_log
       ORDER BY changed_at DESC`,
    );
    console.log('All bank_balance_log entries:');
    all.forEach(r => {
      const diff = parseFloat(r.new_amount) - parseFloat(r.previous_amount);
      console.log(`  ${r.changed_at.toISOString().split('T')[0]} | prev: ${r.previous_amount} | new: ${r.new_amount} | diff: ${diff > 0 ? '+' : ''}${diff} | source: ${r.source}`);
    });

    // Mark rows where amount INCREASED by 300000 or 200000 as 'injection'
    // These are the manual additions the user made
    const { rowCount } = await client.query(
      `UPDATE bank_balance_log
       SET source = 'injection'
       WHERE (new_amount - previous_amount) IN (300000, 200000, 500000)
         AND source = 'system'`,
    );
    console.log(`\n✓ Updated ${rowCount} row(s) to source = 'injection'`);

    // Show updated entries
    const { rows: updated } = await client.query(
      `SELECT id, previous_amount, new_amount, changed_at, source
       FROM bank_balance_log WHERE source = 'injection'
       ORDER BY changed_at DESC`,
    );
    console.log('\nInjection entries after fix:');
    updated.forEach(r => {
      const diff = parseFloat(r.new_amount) - parseFloat(r.previous_amount);
      console.log(`  ${r.changed_at.toISOString().split('T')[0]} | +${diff} | source: ${r.source}`);
    });

  } finally {
    client.release();
    await pool.end();
  }
}

fix().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
