import type { PoolClient } from 'pg';
import { getPool } from './db';
import { logAudit } from './audit';

export async function adjustBalance(
  delta: number,
  userId: string,
  client?: PoolClient,
  source: 'system' | 'injection' = 'system',
): Promise<number> {
  const db = client || getPool();
  const { rows } = await db.query(
    'SELECT amount FROM bank_balance ORDER BY updated_at DESC LIMIT 1',
  );
  const current = parseFloat(rows[0]?.amount || '0');
  const next = current + delta;
  await db.query('INSERT INTO bank_balance (amount, updated_by) VALUES ($1, $2)', [
    next,
    userId,
  ]);
  await db.query(
    'INSERT INTO bank_balance_log (previous_amount, new_amount, changed_by, source) VALUES ($1, $2, $3, $4)',
    [current, next, userId, source],
  );
  return next;
}

export async function getCurrentBalance() {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT b.amount, b.updated_at, u.name as updated_by_name
     FROM bank_balance b JOIN users u ON u.id = b.updated_by
     ORDER BY b.updated_at DESC LIMIT 1`,
  );
  return rows[0] || { amount: 0, updated_at: null, updated_by_name: null };
}

export async function setBalance(amount: number, userId: string, source: 'restore' | 'system' = 'restore') {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT amount FROM bank_balance ORDER BY updated_at DESC LIMIT 1',
    );
    const prev = rows[0]?.amount || 0;
    await client.query('INSERT INTO bank_balance (amount, updated_by) VALUES ($1, $2)', [
      amount,
      userId,
    ]);
    await client.query(
      'INSERT INTO bank_balance_log (previous_amount, new_amount, changed_by, source) VALUES ($1, $2, $3, $4)',
      [prev, amount, userId, source],
    );
    await logAudit(
      userId,
      'UPDATE',
      'bank_balance',
      null,
      { amount: prev },
      { amount },
      client,
    );
    await client.query('COMMIT');
    return { amount, updated_at: new Date() };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
