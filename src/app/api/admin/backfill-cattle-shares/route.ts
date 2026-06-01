import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireSuperAdmin } from '@/lib/auth';
import { getPool } from '@/lib/db';
import { getPartnerIds, calculateShares } from '@/lib/partners';
import { withHandler } from '@/lib/http';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/backfill-cattle-shares
 * Backfills cattle_shares for all cattle that don't have share records yet.
 * Super admin only. Safe to run multiple times (uses ON CONFLICT DO NOTHING).
 */
export const POST = withHandler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  requireSuperAdmin(user);

  const pool = getPool();
  const partnerIds = await getPartnerIds();

  // Find all cattle purchases without share records
  const { rows: purchases } = await pool.query(
    `SELECT c.id, c.purchase_price, c.sale_price, c.is_sold
     FROM cattle c
     WHERE NOT EXISTS (
       SELECT 1 FROM cattle_shares cs
       WHERE cs.cattle_id = c.id AND cs.entry_type = 'purchase'
     )`,
  );

  let purchasesBackfilled = 0;
  let salesBackfilled = 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const cattle of purchases) {
      // Insert purchase shares
      for (const s of calculateShares(parseFloat(cattle.purchase_price), partnerIds)) {
        await client.query(
          `INSERT INTO cattle_shares (cattle_id, partner_id, share_amount, entry_type)
           VALUES ($1,$2,$3,'purchase')
           ON CONFLICT (cattle_id, partner_id, entry_type) DO NOTHING`,
          [cattle.id, s.partnerId, s.share],
        );
      }
      purchasesBackfilled++;

      // If already sold and no sale shares exist, insert those too
      if (cattle.is_sold && cattle.sale_price) {
        const { rows: existingSale } = await client.query(
          `SELECT 1 FROM cattle_shares WHERE cattle_id=$1 AND entry_type='sale'`,
          [cattle.id],
        );
        if (existingSale.length === 0) {
          for (const s of calculateShares(parseFloat(cattle.sale_price), partnerIds)) {
            await client.query(
              `INSERT INTO cattle_shares (cattle_id, partner_id, share_amount, entry_type)
               VALUES ($1,$2,$3,'sale')
               ON CONFLICT (cattle_id, partner_id, entry_type) DO NOTHING`,
              [cattle.id, s.partnerId, s.share],
            );
          }
          salesBackfilled++;
        }
      }
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  return NextResponse.json({
    message: 'Backfill complete.',
    purchasesBackfilled,
    salesBackfilled,
  });
});
