import { getPool } from './db';

export async function getPartnerIds(): Promise<string[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id FROM users
     WHERE phone_number IN ('03485157554','03418888818','03358073584')
     ORDER BY created_at ASC`,
  );
  if (rows.length === 3) return rows.map((r: { id: string }) => r.id);
  const { rows: all } = await pool.query(
    'SELECT id FROM users ORDER BY created_at ASC LIMIT 3',
  );
  return all.map((r: { id: string }) => r.id);
}

export function calculateShares(amount: number, partnerIds: string[]) {
  const base = Math.round(amount / 3);
  return [
    { partnerId: partnerIds[0], share: amount - 2 * base },
    { partnerId: partnerIds[1], share: base },
    { partnerId: partnerIds[2], share: base },
  ];
}
