import type { PoolClient } from 'pg';
import { getPool } from './db';

export async function logAudit(
  userId: string,
  action: string,
  entityType: string,
  entityId?: string | null,
  oldValue?: Record<string, unknown> | null,
  newValue?: Record<string, unknown> | null,
  client?: PoolClient,
): Promise<void> {
  const db = client || getPool();
  await db.query(
    `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      userId,
      action,
      entityType,
      entityId || null,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
    ],
  );
}
