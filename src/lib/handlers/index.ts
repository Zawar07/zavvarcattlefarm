import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { requireAuth, requireSuperAdmin, type AuthUser } from '@/lib/auth';
import { getPool } from '@/lib/db';
import { adjustBalance, getCurrentBalance, setBalance } from '@/lib/bank';
import { logAudit } from '@/lib/audit';
import { getPartnerIds, calculateShares } from '@/lib/partners';
import { uploadReceipt } from '@/lib/blob';
import { parseForm } from '@/lib/multipart';
import { AppError } from '@/lib/errors';
import { parseJsonBody, queryParams, type RouteContext, methodNotAllowed } from '@/lib/http';

export async function methodNotAllowedResponse() {
  return methodNotAllowed();
}

type Handler = (
  req: NextRequest,
  ctx: RouteContext,
) => Promise<NextResponse>;

type HandlerModule = Partial<Record<'GET' | 'POST' | 'PATCH' | 'DELETE', Handler>>;

const PHONE_REGEX = /^03\d{9}$/;
const VALID_CATTLE_TYPES = ['bull', 'cow', 'goat', 'sheep', 'chicken'];

// ── Bank ─────────────────────────────────────────────────────────────────────

export const bankBalance: HandlerModule = {
  async GET(req) {
    await requireAuth(req);
    return NextResponse.json(await getCurrentBalance());
  },
  async POST(req) {
    const user = await requireAuth(req);
    const { amount } = await parseJsonBody<{ amount?: number }>(req);
    if (amount === undefined || isNaN(Number(amount))) {
      throw new AppError(400, 'VALIDATION_INVALID_AMOUNT', 'Valid amount is required.');
    }
    return NextResponse.json(await setBalance(Number(amount), user.id));
  },
  async PATCH(req) {
    // Add (or subtract if negative) an amount to the current balance
    const user = await requireAuth(req);
    const { amount } = await parseJsonBody<{ amount?: number }>(req);
    if (amount === undefined || isNaN(Number(amount))) {
      throw new AppError(400, 'VALIDATION_INVALID_AMOUNT', 'Valid amount is required.');
    }
    return NextResponse.json(await adjustBalance(Number(amount), user.id, undefined, 'injection'));
  },
};

export const bankLog: HandlerModule = {
  async GET(req) {
    await requireAuth(req);
    const { rows } = await getPool().query(
      `SELECT l.id, l.previous_amount, l.new_amount, l.changed_at, u.name as changed_by_name
       FROM bank_balance_log l JOIN users u ON u.id = l.changed_by
       ORDER BY l.changed_at DESC`,
    );
    return NextResponse.json(rows);
  },
};

// ── Expenses ─────────────────────────────────────────────────────────────────

export const expensesIndex: HandlerModule = {
  async GET(req) {
    await requireAuth(req);
    const q = queryParams(req);
    const pool = getPool();
    const conditions: string[] = ['e.deleted_at IS NULL'];
    const params: unknown[] = [];
    let idx = 1;
    if (q.category) {
      conditions.push(`ec.name ILIKE $${idx++}`);
      params.push(`%${q.category}%`);
    }
    if (q.sub_category) {
      conditions.push(`e.sub_category ILIKE $${idx++}`);
      params.push(`%${q.sub_category}%`);
    }
    if (q.from_date) {
      conditions.push(`e.expense_date >= $${idx++}`);
      params.push(q.from_date);
    }
    if (q.to_date) {
      conditions.push(`e.expense_date <= $${idx++}`);
      params.push(q.to_date);
    }
    if (q.recorded_by) {
      conditions.push(`e.recorded_by = $${idx++}`);
      params.push(q.recorded_by);
    }
    if (q.is_animal_cost !== undefined) {
      conditions.push(`e.is_animal_cost = $${idx++}`);
      params.push(q.is_animal_cost === 'true');
    }
    const p = parseInt(q.page || '1');
    const l = parseInt(q.limit || '50');
    const offset = (p - 1) * l;
    const where = `WHERE ${conditions.join(' AND ')}`;
    const { rows } = await pool.query(
      `SELECT e.*, ec.name as category_name, u.name as recorded_by_name
       FROM expenses e
       JOIN expense_categories ec ON ec.id = e.category_id
       JOIN users u ON u.id = e.recorded_by
       ${where}
       ORDER BY e.expense_date DESC, e.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, l, offset],
    );
    const { rows: cnt } = await pool.query(
      `SELECT COUNT(*) as total, COALESCE(SUM(e.amount),0) as total_amount
       FROM expenses e JOIN expense_categories ec ON ec.id = e.category_id ${where}`,
      params,
    );
    return NextResponse.json({
      expenses: rows,
      total: parseInt(cnt[0].total),
      total_amount: parseFloat(cnt[0].total_amount),
      page: p,
      limit: l,
    });
  },
  async POST(req) {
    const user = await requireAuth(req);
    const pool = getPool();
    const { fields, file } = await parseForm(req);
    const { amount, category_id, sub_category, description, expense_date } = fields;
    // is_animal_cost: '1' or 'true' means yes (default true)
    const isAnimalCost = fields.is_animal_cost === '0' || fields.is_animal_cost === 'false' ? false : true;
    if (!amount || !category_id || !sub_category || !expense_date) {
      throw new AppError(
        400,
        'VALIDATION_MISSING_FIELDS',
        'amount, category_id, sub_category, and expense_date are required.',
      );
    }
    let receipt_image_path: string | null = null;
    if (file) receipt_image_path = await uploadReceipt(file.buffer, file.originalname);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO expenses (amount, category_id, sub_category, description, expense_date, receipt_image_path, recorded_by, is_animal_cost)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [
          parseFloat(amount),
          parseInt(category_id),
          sub_category,
          description || null,
          expense_date,
          receipt_image_path,
          user.id,
          isAnimalCost,
        ],
      );
      const expense = rows[0];
      const partnerIds = await getPartnerIds();
      for (const s of calculateShares(parseFloat(amount), partnerIds)) {
        await client.query(
          'INSERT INTO partner_shares (expense_id, partner_id, share_amount) VALUES ($1,$2,$3)',
          [expense.id, s.partnerId, s.share],
        );
      }
      const newBalance = await adjustBalance(-parseFloat(amount), user.id, client);
      await logAudit(
        user.id,
        'CREATE',
        'expense',
        expense.id,
        null,
        { amount, category_id, sub_category },
        client,
      );
      await client.query('COMMIT');
      return NextResponse.json(
        { expense, warning: newBalance < 0 ? 'LOW_BALANCE' : undefined },
        { status: 201 },
      );
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },
};

export const expenseCategories: HandlerModule = {
  async GET(req) {
    await requireAuth(req);
    const { rows } = await getPool().query(
      'SELECT id, name FROM expense_categories ORDER BY id ASC',
    );
    return NextResponse.json(rows);
  },
};

export const expenseSummary: HandlerModule = {
  async GET(req) {
    await requireAuth(req);
    const q = queryParams(req);
    const conditions = ['e.deleted_at IS NULL'];
    const params: unknown[] = [];
    let idx = 1;
    if (q.from_date) {
      conditions.push(`e.expense_date >= $${idx++}`);
      params.push(q.from_date);
    }
    if (q.to_date) {
      conditions.push(`e.expense_date <= $${idx++}`);
      params.push(q.to_date);
    }
    const { rows } = await getPool().query(
      `SELECT ec.name as category, COALESCE(SUM(e.amount),0) as total
       FROM expenses e JOIN expense_categories ec ON ec.id = e.category_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY ec.name ORDER BY total DESC`,
      params,
    );
    return NextResponse.json(rows);
  },
};

export const expenseById: HandlerModule = {
  async GET(req, { params }) {
    await requireAuth(req);
    const pool = getPool();
    const id = params.id;
    const { rows } = await pool.query(
      `SELECT e.*, ec.name as category_name, u.name as recorded_by_name
       FROM expenses e
       JOIN expense_categories ec ON ec.id = e.category_id
       JOIN users u ON u.id = e.recorded_by
       WHERE e.id = $1 AND e.deleted_at IS NULL`,
      [id],
    );
    if (!rows[0]) throw new AppError(404, 'EXPENSE_NOT_FOUND', 'Expense not found.');
    const { rows: shares } = await pool.query(
      `SELECT ps.share_amount, u.name as partner_name, u.id as partner_id
       FROM partner_shares ps JOIN users u ON u.id = ps.partner_id
       WHERE ps.expense_id = $1`,
      [id],
    );
    return NextResponse.json({ ...rows[0], partner_shares: shares });
  },
  async PATCH(req, { params }) {
    const user = await requireAuth(req);
    const pool = getPool();
    const id = params.id;
    const body = await parseJsonBody<Record<string, unknown>>(req);
    const { rows: existing } = await pool.query(
      'SELECT * FROM expenses WHERE id = $1 AND deleted_at IS NULL',
      [id],
    );
    if (!existing[0]) throw new AppError(404, 'EXPENSE_NOT_FOUND', 'Expense not found.');
    if (user.role !== 'super_admin') {
      const hrs = (Date.now() - new Date(existing[0].created_at).getTime()) / 3600000;
      if (hrs > 24) throw new AppError(403, 'FORBIDDEN', 'Expense can only be edited within 24 hours.');
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const updates: string[] = [];
      const p: unknown[] = [];
      let idx = 1;
      if (body.amount !== undefined) {
        updates.push(`amount = $${idx++}`);
        p.push(parseFloat(String(body.amount)));
      }
      if (body.category_id !== undefined) {
        updates.push(`category_id = $${idx++}`);
        p.push(parseInt(String(body.category_id)));
      }
      if (body.sub_category !== undefined) {
        updates.push(`sub_category = $${idx++}`);
        p.push(body.sub_category);
      }
      if (body.description !== undefined) {
        updates.push(`description = $${idx++}`);
        p.push(body.description);
      }
      if (body.expense_date !== undefined) {
        updates.push(`expense_date = $${idx++}`);
        p.push(body.expense_date);
      }
      if (body.is_animal_cost !== undefined) {
        updates.push(`is_animal_cost = $${idx++}`);
        p.push(Boolean(body.is_animal_cost));
      }
      updates.push('updated_at = NOW()');
      p.push(id);
      const { rows: updated } = await client.query(
        `UPDATE expenses SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        p,
      );
      if (body.amount !== undefined) {
        await client.query('DELETE FROM partner_shares WHERE expense_id = $1', [id]);
        const partnerIds = await getPartnerIds();
        for (const s of calculateShares(parseFloat(String(body.amount)), partnerIds)) {
          await client.query(
            'INSERT INTO partner_shares (expense_id, partner_id, share_amount) VALUES ($1,$2,$3)',
            [id, s.partnerId, s.share],
          );
        }
        await adjustBalance(
          -(parseFloat(String(body.amount)) - parseFloat(existing[0].amount)),
          user.id,
          client,
        );
      }
      await logAudit(user.id, 'UPDATE', 'expense', id, existing[0], updated[0], client);
      await client.query('COMMIT');
      return NextResponse.json(updated[0]);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },
  async DELETE(req, { params }) {
    const user = await requireAuth(req);
    requireSuperAdmin(user);
    const pool = getPool();
    const id = params.id;
    const { rows } = await pool.query(
      'SELECT * FROM expenses WHERE id = $1 AND deleted_at IS NULL',
      [id],
    );
    if (!rows[0]) throw new AppError(404, 'EXPENSE_NOT_FOUND', 'Expense not found.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE expenses SET deleted_at = NOW() WHERE id = $1', [id]);
      await client.query('DELETE FROM partner_shares WHERE expense_id = $1', [id]);
      await adjustBalance(parseFloat(rows[0].amount), user.id, client);
      await logAudit(user.id, 'DELETE', 'expense', id, rows[0], null, client);
      await client.query('COMMIT');
      return NextResponse.json({ message: 'Expense deleted.' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },
};

// ── Cattle ───────────────────────────────────────────────────────────────────

export const cattleIndex: HandlerModule = {
  async GET(req) {
    await requireAuth(req);
    const q = queryParams(req);
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (q.animal_type) {
      conditions.push(`c.animal_type = $${idx++}`);
      params.push(q.animal_type);
    }
    if (q.is_sold !== undefined) {
      conditions.push(`c.is_sold = $${idx++}`);
      params.push(q.is_sold === 'true');
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await getPool().query(
      `SELECT c.*, u.name as recorded_by_name,
              CASE WHEN c.is_sold THEN c.sale_price - c.purchase_price ELSE NULL END as profit_loss
       FROM cattle c JOIN users u ON u.id = c.recorded_by
       ${where}
       ORDER BY c.purchase_date DESC, c.created_at DESC`,
      params,
    );
    return NextResponse.json(rows);
  },
  async POST(req) {
    const user = await requireAuth(req);
    const pool = getPool();
    const { fields, file } = await parseForm(req);
    const { animal_type, purchase_price, purchase_date, description } = fields;
    if (!animal_type || !purchase_price || !purchase_date) {
      throw new AppError(
        400,
        'VALIDATION_MISSING_FIELDS',
        'animal_type, purchase_price, and purchase_date are required.',
      );
    }
    if (!VALID_CATTLE_TYPES.includes(animal_type)) {
      throw new AppError(
        400,
        'VALIDATION_INVALID_TYPE',
        `animal_type must be one of: ${VALID_CATTLE_TYPES.join(', ')}`,
      );
    }
    let image_url: string | null = null;
    if (file) image_url = await uploadReceipt(file.buffer, file.originalname);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO cattle (animal_type, purchase_price, purchase_date, description, image_url, recorded_by)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [
          animal_type,
          parseFloat(purchase_price),
          purchase_date,
          description || null,
          image_url,
          user.id,
        ],
      );
      const newBalance = await adjustBalance(-parseFloat(purchase_price), user.id, client);
      await logAudit(user.id, 'CREATE', 'cattle', rows[0].id, null, rows[0], client);
      // ── Split cattle purchase cost among partners ──────────────────────
      const partnerIds = await getPartnerIds();
      for (const s of calculateShares(parseFloat(purchase_price), partnerIds)) {
        await client.query(
          `INSERT INTO cattle_shares (cattle_id, partner_id, share_amount, entry_type)
           VALUES ($1,$2,$3,'purchase')
           ON CONFLICT (cattle_id, partner_id, entry_type) DO NOTHING`,
          [rows[0].id, s.partnerId, s.share],
        );
      }
      await client.query('COMMIT');
      return NextResponse.json(
        { cattle: rows[0], warning: newBalance < 0 ? 'LOW_BALANCE' : undefined },
        { status: 201 },
      );
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },
};

export const cattleSummary: HandlerModule = {
  async GET(req) {
    await requireAuth(req);
    const { rows } = await getPool().query(
      `SELECT
         COUNT(*) FILTER (WHERE animal_type='bull' AND is_sold=FALSE) as bulls,
         COUNT(*) FILTER (WHERE animal_type='cow'  AND is_sold=FALSE) as cows,
         COUNT(*) FILTER (WHERE animal_type='goat' AND is_sold=FALSE) as goats,
         COUNT(*) FILTER (WHERE animal_type='sheep' AND is_sold=FALSE) as sheep,
         COUNT(*) FILTER (WHERE animal_type='chicken' AND is_sold=FALSE) as chickens,
         COUNT(*) FILTER (WHERE is_sold=FALSE) as total_active,
         COUNT(*) FILTER (WHERE is_sold=TRUE) as sold_count,
         COALESCE(SUM(purchase_price) FILTER (WHERE is_sold=FALSE),0) as total_inventory_value
       FROM cattle`,
    );
    return NextResponse.json(rows[0]);
  },
};

export const cattleById: HandlerModule = {
  async GET(req, { params }) {
    await requireAuth(req);
    const { rows } = await getPool().query(
      `SELECT c.*, u.name as recorded_by_name,
              CASE WHEN c.is_sold THEN c.sale_price - c.purchase_price ELSE NULL END as profit_loss
       FROM cattle c JOIN users u ON u.id = c.recorded_by WHERE c.id = $1`,
      [params.id],
    );
    if (!rows[0]) throw new AppError(404, 'CATTLE_NOT_FOUND', 'Cattle record not found.');
    return NextResponse.json(rows[0]);
  },
  async PATCH(req, { params }) {
    const user = await requireAuth(req);
    const pool = getPool();
    const id = params.id;
    const { rows: existing } = await pool.query('SELECT * FROM cattle WHERE id = $1', [id]);
    if (!existing[0]) throw new AppError(404, 'CATTLE_NOT_FOUND', 'Cattle record not found.');
    if (user.role !== 'super_admin') {
      const hrs = (Date.now() - new Date(existing[0].created_at).getTime()) / 3600000;
      if (hrs > 24) throw new AppError(403, 'FORBIDDEN', 'Cattle can only be edited within 24 hours.');
    }
    const { fields, file } = await parseForm(req);
    const updates: string[] = [];
    const p: unknown[] = [];
    let idx = 1;
    if (fields.animal_type !== undefined) {
      if (!['bull', 'cow', 'goat', 'sheep', 'chicken'].includes(fields.animal_type)) {
        throw new AppError(400, 'VALIDATION_INVALID_TYPE', 'Invalid animal_type.');
      }
      updates.push(`animal_type = $${idx++}`);
      p.push(fields.animal_type);
    }
    if (fields.purchase_price !== undefined) {
      updates.push(`purchase_price = $${idx++}`);
      p.push(parseFloat(fields.purchase_price));
    }
    if (fields.purchase_date !== undefined) {
      updates.push(`purchase_date = $${idx++}`);
      p.push(fields.purchase_date);
    }
    if (fields.description !== undefined) {
      updates.push(`description = $${idx++}`);
      p.push(fields.description || null);
    }
    if (file) {
      const imageUrl = await uploadReceipt(file.buffer, file.originalname);
      updates.push(`image_url = $${idx++}`);
      p.push(imageUrl);
    }
    if (updates.length === 0) throw new AppError(400, 'NO_CHANGES', 'No fields to update.');
    updates.push('updated_at = NOW()');
    p.push(id);
    const { rows } = await pool.query(
      `UPDATE cattle SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      p,
    );
    if (fields.purchase_price !== undefined) {
      const priceDiff = parseFloat(fields.purchase_price) - parseFloat(existing[0].purchase_price);
      if (priceDiff !== 0) {
        await adjustBalance(-priceDiff, user.id);
      }
    }
    await logAudit(user.id, 'UPDATE', 'cattle', id, existing[0], rows[0]);
    return NextResponse.json(rows[0]);
  },
};

async function sellCattle(req: NextRequest, id: string, user: AuthUser) {
  const pool = getPool();
  const { sale_price, sale_date } = await parseJsonBody<{
    sale_price?: number;
    sale_date?: string;
  }>(req);
  if (!sale_price || !sale_date) {
    throw new AppError(400, 'VALIDATION_MISSING_FIELDS', 'sale_price and sale_date are required.');
  }
  const { rows } = await pool.query('SELECT * FROM cattle WHERE id = $1', [id]);
  if (!rows[0]) throw new AppError(404, 'CATTLE_NOT_FOUND', 'Cattle record not found.');
  if (rows[0].is_sold) throw new AppError(409, 'ALREADY_SOLD', 'This animal has already been sold.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: updated } = await client.query(
      `UPDATE cattle SET sale_price=$1, sale_date=$2, is_sold=TRUE, updated_at=NOW()
       WHERE id=$3 RETURNING *`,
      [parseFloat(String(sale_price)), sale_date, id],
    );
    const newBalance = await adjustBalance(parseFloat(String(sale_price)), user.id, client);
    await logAudit(user.id, 'SELL', 'cattle', id, rows[0], updated[0], client);
    // ── Split cattle sale proceeds among partners (reduces outstanding) ──
    const partnerIds = await getPartnerIds();
    for (const s of calculateShares(parseFloat(String(sale_price)), partnerIds)) {
      await client.query(
        `INSERT INTO cattle_shares (cattle_id, partner_id, share_amount, entry_type)
         VALUES ($1,$2,$3,'sale')
         ON CONFLICT (cattle_id, partner_id, entry_type) DO NOTHING`,
        [id, s.partnerId, s.share],
      );
    }
    await client.query('COMMIT');
    return NextResponse.json({
      ...updated[0],
      profit_loss: parseFloat(String(sale_price)) - parseFloat(rows[0].purchase_price),
      newBalance,
    });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export const cattleSell: HandlerModule = {
  async PATCH(req, { params }) {
    const user = await requireAuth(req);
    return sellCattle(req, params.id, user);
  },
};

// ── Employees ────────────────────────────────────────────────────────────────

export const employeesIndex: HandlerModule = {
  async GET(req) {
    await requireAuth(req);
    const { rows } = await getPool().query('SELECT * FROM employees ORDER BY name ASC');
    return NextResponse.json(rows);
  },
  async POST(req) {
    const user = await requireAuth(req);
    requireSuperAdmin(user);
    const { name, base_salary } = await parseJsonBody<{
      name?: string;
      base_salary?: number;
    }>(req);
    if (!name || base_salary === undefined) {
      throw new AppError(400, 'VALIDATION_MISSING_FIELDS', 'name and base_salary required.');
    }
    const { rows } = await getPool().query(
      'INSERT INTO employees (name, base_salary) VALUES ($1,$2) RETURNING *',
      [name, parseFloat(String(base_salary))],
    );
    await logAudit(user.id, 'CREATE', 'employee', rows[0].id, null, rows[0]);
    return NextResponse.json(rows[0], { status: 201 });
  },
};

export const employeeById: HandlerModule = {
  async PATCH(req, { params }) {
    const user = await requireAuth(req);
    requireSuperAdmin(user);
    const body = await parseJsonBody<Record<string, unknown>>(req);
    const updates: string[] = [];
    const p: unknown[] = [];
    let idx = 1;
    if (body.name !== undefined) {
      updates.push(`name = $${idx++}`);
      p.push(body.name);
    }
    if (body.base_salary !== undefined) {
      updates.push(`base_salary = $${idx++}`);
      p.push(parseFloat(String(body.base_salary)));
    }
    if (body.is_active !== undefined) {
      updates.push(`is_active = $${idx++}`);
      p.push(body.is_active);
    }
    updates.push('updated_at = NOW()');
    p.push(params.id);
    const { rows } = await getPool().query(
      `UPDATE employees SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      p,
    );
    if (!rows[0]) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found.');
    await logAudit(user.id, 'UPDATE', 'employee', params.id, null, rows[0]);
    return NextResponse.json(rows[0]);
  },
};

export const employeeExpenses: HandlerModule = {
  async GET(req, { params }) {
    await requireAuth(req);
    const q = queryParams(req);
    const conditions = [`ee.employee_id = $1`, `ee.deleted_at IS NULL`];
    const p: unknown[] = [params.id];
    let idx = 2;
    if (q.month) {
      conditions.push(`TO_CHAR(ee.expense_date,'YYYY-MM') = $${idx++}`);
      p.push(q.month);
    }
    const { rows } = await getPool().query(
      `SELECT ee.*, u.name as recorded_by_name
       FROM employee_expenses ee JOIN users u ON u.id = ee.recorded_by
       WHERE ${conditions.join(' AND ')} ORDER BY ee.expense_date DESC`,
      p,
    );
    return NextResponse.json(rows);
  },
  async POST(req, { params }) {
    const user = await requireAuth(req);
    const pool = getPool();
    const { category, amount, expense_date, description } = await parseJsonBody<{
      category?: string;
      amount?: number;
      expense_date?: string;
      description?: string;
    }>(req);
    if (!category || !amount || !expense_date) {
      throw new AppError(
        400,
        'VALIDATION_MISSING_FIELDS',
        'category, amount, expense_date required.',
      );
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO employee_expenses (employee_id, category, amount, expense_date, description, recorded_by)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [
          params.id,
          category,
          parseFloat(String(amount)),
          expense_date,
          description || null,
          user.id,
        ],
      );
      const newBalance = await adjustBalance(-parseFloat(String(amount)), user.id, client);
      await logAudit(user.id, 'CREATE', 'employee_expense', rows[0].id, null, rows[0], client);
      await client.query('COMMIT');
      return NextResponse.json({ ...rows[0], newBalance }, { status: 201 });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },
};

export const employeePayroll: HandlerModule = {
  async GET(req, { params }) {
    await requireAuth(req);
    const q = queryParams(req);
    if (!q.month) throw new AppError(400, 'VALIDATION_MISSING_FIELDS', 'month (YYYY-MM) required.');
    const pool = getPool();
    const { rows: emp } = await pool.query('SELECT * FROM employees WHERE id = $1', [params.id]);
    if (!emp[0]) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found.');
    const { rows: expenses } = await pool.query(
      `SELECT * FROM employee_expenses
       WHERE employee_id=$1 AND deleted_at IS NULL AND TO_CHAR(expense_date,'YYYY-MM')=$2
       ORDER BY expense_date ASC`,
      [params.id, q.month],
    );
    const totalExpenses = expenses.reduce(
      (s: number, e: { amount: string }) => s + parseFloat(e.amount),
      0,
    );
    const totalCost = parseFloat(emp[0].base_salary) + totalExpenses;
    const { rows: payroll } = await pool.query(
      `SELECT * FROM payroll_records WHERE employee_id=$1 AND TO_CHAR(month,'YYYY-MM')=$2`,
      [params.id, q.month],
    );
    return NextResponse.json({
      employee: emp[0],
      month: q.month,
      base_salary: parseFloat(emp[0].base_salary),
      expenses,
      total_expenses: totalExpenses,
      total_cost: totalCost,
      payroll_processed: payroll[0] || null,
    });
  },
  async POST(req, { params }) {
    const user = await requireAuth(req);
    requireSuperAdmin(user);
    const { month } = await parseJsonBody<{ month?: string }>(req);
    if (!month) throw new AppError(400, 'VALIDATION_MISSING_FIELDS', 'month (YYYY-MM) required.');
    const pool = getPool();
    const { rows: emp } = await pool.query('SELECT * FROM employees WHERE id = $1', [params.id]);
    if (!emp[0]) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found.');
    const { rows: existing } = await pool.query(
      `SELECT id FROM payroll_records WHERE employee_id=$1 AND TO_CHAR(month,'YYYY-MM')=$2`,
      [params.id, month],
    );
    if (existing[0]) {
      throw new AppError(409, 'DUPLICATE_PAYROLL', 'Payroll already processed for this month.');
    }
    const { rows: expTotals } = await pool.query(
      `SELECT COALESCE(SUM(amount),0) as total FROM employee_expenses
       WHERE employee_id=$1 AND deleted_at IS NULL AND TO_CHAR(expense_date,'YYYY-MM')=$2`,
      [params.id, month],
    );
    const totalExpenses = parseFloat(expTotals[0].total);
    const baseSalary = parseFloat(emp[0].base_salary);
    const totalCost = baseSalary + totalExpenses;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO payroll_records (employee_id, month, base_salary, total_expenses, total_cost, processed_by)
         VALUES ($1,$2::date,$3,$4,$5,$6) RETURNING *`,
        [params.id, `${month}-01`, baseSalary, totalExpenses, totalCost, user.id],
      );
      await adjustBalance(-baseSalary, user.id, client);
      await logAudit(user.id, 'PROCESS_PAYROLL', 'payroll', rows[0].id, null, rows[0], client);
      await client.query('COMMIT');
      return NextResponse.json(rows[0], { status: 201 });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },
};

export const employeeExpenseById: HandlerModule = {
  async PATCH(req, { params }) {
    const user = await requireAuth(req);
    const pool = getPool();
    const id = params.id;
    const { rows } = await pool.query(
      'SELECT * FROM employee_expenses WHERE id=$1 AND deleted_at IS NULL',
      [id],
    );
    if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Employee expense not found.');
    if (user.role !== 'super_admin') {
      const hrs = (Date.now() - new Date(rows[0].created_at).getTime()) / 3600000;
      if (hrs > 24) throw new AppError(403, 'FORBIDDEN', 'Can only edit within 24 hours.');
    }
    const body = await parseJsonBody<Record<string, unknown>>(req);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const updates: string[] = [];
      const p: unknown[] = [];
      let idx = 1;
      if (body.amount !== undefined) {
        updates.push(`amount=$${idx++}`);
        p.push(parseFloat(String(body.amount)));
      }
      if (body.category !== undefined) {
        updates.push(`category=$${idx++}`);
        p.push(body.category);
      }
      if (body.description !== undefined) {
        updates.push(`description=$${idx++}`);
        p.push(body.description);
      }
      if (body.expense_date !== undefined) {
        updates.push(`expense_date=$${idx++}`);
        p.push(body.expense_date);
      }
      updates.push('updated_at=NOW()');
      p.push(id);
      const { rows: updated } = await client.query(
        `UPDATE employee_expenses SET ${updates.join(',')} WHERE id=$${idx} RETURNING *`,
        p,
      );
      if (body.amount !== undefined) {
        await adjustBalance(
          -(parseFloat(String(body.amount)) - parseFloat(rows[0].amount)),
          user.id,
          client,
        );
      }
      await logAudit(user.id, 'UPDATE', 'employee_expense', id, rows[0], updated[0], client);
      await client.query('COMMIT');
      return NextResponse.json(updated[0]);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },
  async DELETE(req, { params }) {
    const user = await requireAuth(req);
    requireSuperAdmin(user);
    const pool = getPool();
    const id = params.id;
    const { rows } = await pool.query(
      'SELECT * FROM employee_expenses WHERE id=$1 AND deleted_at IS NULL',
      [id],
    );
    if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Employee expense not found.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE employee_expenses SET deleted_at=NOW() WHERE id=$1', [id]);
      await adjustBalance(parseFloat(rows[0].amount), user.id, client);
      await logAudit(user.id, 'DELETE', 'employee_expense', id, rows[0], null, client);
      await client.query('COMMIT');
      return NextResponse.json({ message: 'Deleted.' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },
};

// ── Ledger ───────────────────────────────────────────────────────────────────

async function getLedgerEntries(from_date?: string, to_date?: string) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (from_date) {
    conditions.push(`entry_date >= $${idx++}`);
    params.push(from_date);
  }
  if (to_date) {
    conditions.push(`entry_date <= $${idx++}`);
    params.push(to_date);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await getPool().query(
    `SELECT * FROM (
       SELECT e.id, 'expense' as entry_type, e.expense_date as entry_date,
              ec.name as category, e.sub_category as description,
              -e.amount as amount, u.name as recorded_by_name, e.receipt_image_path
       FROM expenses e
       JOIN expense_categories ec ON ec.id = e.category_id
       JOIN users u ON u.id = e.recorded_by
       WHERE e.deleted_at IS NULL
       UNION ALL
       SELECT c.id, 'cattle_purchase' as entry_type, c.purchase_date as entry_date,
              'Cattle Purchase' as category,
              CONCAT(INITCAP(c.animal_type),' - ',COALESCE(c.description,'No description')) as description,
              -c.purchase_price as amount, u.name as recorded_by_name, NULL as receipt_image_path
       FROM cattle c JOIN users u ON u.id = c.recorded_by
       UNION ALL
       SELECT c.id, 'cattle_sale' as entry_type, c.sale_date as entry_date,
              'Cattle Sale' as category,
              CONCAT(INITCAP(c.animal_type),' - ',COALESCE(c.description,'No description')) as description,
              c.sale_price as amount, u.name as recorded_by_name, NULL as receipt_image_path
       FROM cattle c JOIN users u ON u.id = c.recorded_by
       WHERE c.is_sold = TRUE AND c.sale_date IS NOT NULL
       UNION ALL
       SELECT l.id, 'capital_injection' as entry_type, l.changed_at::date as entry_date,
              'Capital Injection' as category,
              'Bank Balance Added' as description,
              (l.new_amount - l.previous_amount) as amount,
              u.name as recorded_by_name, NULL as receipt_image_path
       FROM bank_balance_log l
       JOIN users u ON u.id = l.changed_by
       WHERE l.source = 'injection'
     ) ledger
     ${where}
     ORDER BY entry_date DESC, entry_type`,
    params,
  );
  return rows;
}

export const ledgerIndex: HandlerModule = {
  async GET(req) {
    await requireAuth(req);
    const q = queryParams(req);
    return NextResponse.json(await getLedgerEntries(q.from_date, q.to_date));
  },
};

export const ledgerMonthly: HandlerModule = {
  async GET(req) {
    await requireAuth(req);
    const q = queryParams(req);
    let from_date: string | undefined;
    let to_date: string | undefined;
    if (q.month) {
      const [year, mon] = q.month.split('-').map(Number);
      from_date = `${q.month}-01`;
      to_date = `${q.month}-${String(new Date(year, mon, 0).getDate()).padStart(2, '0')}`;
    }
    const entries = await getLedgerEntries(from_date, to_date);
    return NextResponse.json({ month: q.month, from_date, to_date, entries });
  },
};

// ── Partners ─────────────────────────────────────────────────────────────────

export const partnerShares: HandlerModule = {
  async GET(req) {
    await requireAuth(req);
    const pool = getPool();

    // Auto-backfill: create cattle_shares for any cattle missing them
    const { rows: missing } = await pool.query(
      `SELECT c.id, c.purchase_price, c.sale_price, c.is_sold
       FROM cattle c
       WHERE NOT EXISTS (
         SELECT 1 FROM cattle_shares cs
         WHERE cs.cattle_id = c.id AND cs.entry_type = 'purchase'
       )`,
    );

    if (missing.length > 0) {
      const partnerIds = await getPartnerIds();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const cattle of missing) {
          for (const s of calculateShares(parseFloat(cattle.purchase_price), partnerIds)) {
            await client.query(
              `INSERT INTO cattle_shares (cattle_id, partner_id, share_amount, entry_type)
               VALUES ($1,$2,$3,'purchase')
               ON CONFLICT (cattle_id, partner_id, entry_type) DO NOTHING`,
              [cattle.id, s.partnerId, s.share],
            );
          }
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
            }
          }
        }
        await client.query('COMMIT');
      } catch {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    }

    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.phone_number,
              COALESCE(
                (SELECT SUM(ps.share_amount)
                 FROM partner_shares ps
                 JOIN expenses e ON e.id = ps.expense_id AND e.deleted_at IS NULL
                 WHERE ps.partner_id = u.id)
              , 0)
              +
              COALESCE(
                (SELECT SUM(cs.share_amount)
                 FROM cattle_shares cs
                 WHERE cs.partner_id = u.id AND cs.entry_type = 'purchase')
              , 0)
              -
              COALESCE(
                (SELECT SUM(cs.share_amount)
                 FROM cattle_shares cs
                 WHERE cs.partner_id = u.id AND cs.entry_type = 'sale')
              , 0)
              as total_share,
              COALESCE(
                (SELECT SUM(amount_settled) FROM partner_settlements WHERE partner_id = u.id)
              , 0) as total_settled
       FROM users u
       WHERE u.role IN ('super_admin','partner') AND u.is_active = TRUE
       ORDER BY u.name`,
    );
    return NextResponse.json(
      rows.map(
        (r: {
          id: string;
          name: string;
          phone_number: string;
          total_share: string;
          total_settled: string;
        }) => ({
          ...r,
          outstanding: parseFloat(r.total_share) - parseFloat(r.total_settled),
        }),
      ),
    );
  },
};

export const partnerSettle: HandlerModule = {
  async POST(req, { params }) {
    const user = await requireAuth(req);
    requireSuperAdmin(user);
    const { amount } = await parseJsonBody<{ amount?: number }>(req);
    if (!amount) throw new AppError(400, 'VALIDATION_MISSING_FIELDS', 'amount required.');
    const { rows } = await getPool().query(
      'INSERT INTO partner_settlements (partner_id, amount_settled, settled_by) VALUES ($1,$2,$3) RETURNING *',
      [params.id, parseFloat(String(amount)), user.id],
    );
    await logAudit(user.id, 'SETTLE', 'partner_settlement', rows[0].id, null, rows[0]);
    return NextResponse.json(rows[0], { status: 201 });
  },
};

export const partnerSettlements: HandlerModule = {
  async GET(req, { params }) {
    await requireAuth(req);
    const { rows } = await getPool().query(
      `SELECT ps.*, u.name as settled_by_name
       FROM partner_settlements ps JOIN users u ON u.id=ps.settled_by
       WHERE ps.partner_id=$1 ORDER BY ps.settled_at DESC`,
      [params.id],
    );
    return NextResponse.json(rows);
  },
};

// ── Partner Contributions ─────────────────────────────────────────────────────

export const partnerContributions: HandlerModule = {
  async GET(req) {
    await requireAuth(req);
    const { rows } = await getPool().query(
      `SELECT pc.*, u.name as partner_name, r.name as recorded_by_name
       FROM partner_contributions pc
       JOIN users u ON u.id = pc.partner_id
       JOIN users r ON r.id = pc.recorded_by
       ORDER BY pc.contributed_at DESC`,
    );
    const { rows: totals } = await getPool().query(
      `SELECT u.id, u.name,
              COALESCE(SUM(pc.amount), 0) as total_contributed
       FROM users u
       LEFT JOIN partner_contributions pc ON pc.partner_id = u.id
       WHERE u.role IN ('super_admin', 'partner') AND u.is_active = TRUE
       GROUP BY u.id, u.name ORDER BY u.name`,
    );
    const { rows: injectedRows } = await getPool().query(
      `SELECT COALESCE(SUM(new_amount - previous_amount), 0) as total_injected
       FROM bank_balance_log
       WHERE source = 'injection'`,
    );
    const totalInjected = parseFloat(injectedRows[0]?.total_injected || '0');
    const totalContributed = totals.reduce(
      (sum, t) => sum + parseFloat(String(t.total_contributed)),
      0,
    );
    const unallocated = Math.max(0, totalInjected - totalContributed);
    return NextResponse.json({
      contributions: rows,
      totals,
      summary: {
        total_injected: totalInjected,
        total_contributed: totalContributed,
        unallocated,
        needs_backfill: unallocated > 0,
      },
    });
  },
  async POST(req) {
    const user = await requireAuth(req);
    requireSuperAdmin(user);
    const { partner_id, amount, note } = await parseJsonBody<{
      partner_id?: string;
      amount?: number;
      note?: string;
    }>(req);
    if (!partner_id || !amount || amount <= 0) {
      throw new AppError(400, 'VALIDATION_MISSING_FIELDS', 'partner_id and amount required.');
    }
    const { rows } = await getPool().query(
      `INSERT INTO partner_contributions (partner_id, amount, note, recorded_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [partner_id, amount, note || null, user.id],
    );
    return NextResponse.json(rows[0], { status: 201 });
  },
};

export const partnerContributionById: HandlerModule = {
  async PATCH(req, { params }) {
    const user = await requireAuth(req);
    requireSuperAdmin(user);
    const { amount, note } = await parseJsonBody<{ amount?: number; note?: string }>(req);
    const updates: string[] = [];
    const p: unknown[] = [];
    let idx = 1;
    if (amount !== undefined) { updates.push(`amount=$${idx++}`); p.push(amount); }
    if (note !== undefined)   { updates.push(`note=$${idx++}`);   p.push(note);   }
    if (!updates.length) throw new AppError(400, 'NO_CHANGES', 'Nothing to update.');
    p.push(params.id);
    const { rows } = await getPool().query(
      `UPDATE partner_contributions SET ${updates.join(',')} WHERE id=$${idx} RETURNING *`,
      p,
    );
    if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Contribution not found.');
    return NextResponse.json(rows[0]);
  },
  async DELETE(req, { params }) {
    const user = await requireAuth(req);
    requireSuperAdmin(user);
    const { rows } = await getPool().query(
      'DELETE FROM partner_contributions WHERE id=$1 RETURNING *',
      [params.id],
    );
    if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Contribution not found.');
    return NextResponse.json({ message: 'Deleted.' });
  },
};

// ── Users ────────────────────────────────────────────────────────────────────

export const usersIndex: HandlerModule = {
  async GET(req) {
    const user = await requireAuth(req);
    requireSuperAdmin(user);
    const { rows } = await getPool().query(
      'SELECT id,name,phone_number,role,is_active,created_at FROM users ORDER BY created_at ASC',
    );
    return NextResponse.json(rows);
  },
  async POST(req) {
    const user = await requireAuth(req);
    requireSuperAdmin(user);
    const { name, phone_number, password, role = 'partner' } = await parseJsonBody<{
      name?: string;
      phone_number?: string;
      password?: string;
      role?: string;
    }>(req);
    if (!name || !phone_number || !password) {
      throw new AppError(
        400,
        'VALIDATION_MISSING_FIELDS',
        'name, phone_number, password required.',
      );
    }
    if (!PHONE_REGEX.test(phone_number)) {
      throw new AppError(400, 'VALIDATION_PHONE_FORMAT', 'Phone must be 03XXXXXXXXX.');
    }
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await getPool().query(
      'INSERT INTO users (name,phone_number,password_hash,role) VALUES ($1,$2,$3,$4) RETURNING id,name,phone_number,role,is_active',
      [name, phone_number, hash, role],
    );
    return NextResponse.json(rows[0], { status: 201 });
  },
};

export const userById: HandlerModule = {
  async PATCH(req, { params }) {
    const user = await requireAuth(req);
    requireSuperAdmin(user);
    const { rows: existing } = await getPool().query('SELECT * FROM users WHERE id=$1', [
      params.id,
    ]);
    if (!existing[0]) throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
    const body = await parseJsonBody<{ name?: string; is_active?: boolean }>(req);
    if (body.is_active === false && existing[0].role === 'super_admin') {
      throw new AppError(400, 'CANNOT_DEACTIVATE_ADMIN', 'Cannot deactivate the Super Admin account.');
    }
    const updates: string[] = [];
    const p: unknown[] = [];
    let idx = 1;
    if (body.name !== undefined) {
      updates.push(`name=$${idx++}`);
      p.push(body.name);
    }
    if (body.is_active !== undefined) {
      updates.push(`is_active=$${idx++}`);
      p.push(body.is_active);
    }
    updates.push('updated_at=NOW()');
    p.push(params.id);
    const { rows } = await getPool().query(
      `UPDATE users SET ${updates.join(',')} WHERE id=$${idx} RETURNING id,name,phone_number,role,is_active`,
      p,
    );
    return NextResponse.json(rows[0]);
  },
};

export const userResetPassword: HandlerModule = {
  async POST(req, { params }) {
    const user = await requireAuth(req);
    requireSuperAdmin(user);
    const { new_password } = await parseJsonBody<{ new_password?: string }>(req);
    if (!new_password) {
      throw new AppError(400, 'VALIDATION_MISSING_FIELDS', 'new_password required.');
    }
    const hash = await bcrypt.hash(new_password, 12);
    await getPool().query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [
      hash,
      params.id,
    ]);
    return NextResponse.json({ message: 'Password reset successfully.' });
  },
};

// ── Audit ────────────────────────────────────────────────────────────────────

export const auditIndex: HandlerModule = {
  async GET(req) {
    const user = await requireAuth(req);
    requireSuperAdmin(user);
    const q = queryParams(req);
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (q.user_id) {
      conditions.push(`a.user_id=$${idx++}`);
      params.push(q.user_id);
    }
    if (q.from_date) {
      conditions.push(`a.performed_at>=$${idx++}`);
      params.push(q.from_date);
    }
    if (q.to_date) {
      conditions.push(`a.performed_at<=$${idx++}`);
      params.push(q.to_date);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const p = parseInt(q.page || '1');
    const l = parseInt(q.limit || '50');
    const { rows } = await getPool().query(
      `SELECT a.*, u.name as user_name
       FROM audit_log a JOIN users u ON u.id=a.user_id
       ${where}
       ORDER BY a.performed_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, l, (p - 1) * l],
    );
    return NextResponse.json(rows);
  },
};

// ── Reports ─────────────────────────────────────────────────────────────────

function getDateRange(type: 'weekly' | 'monthly', param: string) {
  if (type === 'monthly') {
    const [year, mon] = param.split('-').map(Number);
    const lastDay = new Date(year, mon, 0).getDate();
    return {
      from_date: `${param}-01`,
      to_date: `${param}-${String(lastDay).padStart(2, '0')}`,
    };
  }
  const [year, weekNum] = param.split('-W').map(Number);
  const jan4 = new Date(year, 0, 4);
  const start = new Date(jan4);
  start.setDate(jan4.getDate() - jan4.getDay() + 1 + (weekNum - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    from_date: start.toISOString().split('T')[0],
    to_date: end.toISOString().split('T')[0],
  };
}

async function getReportData(from_date: string, to_date: string) {
  const pool = getPool();
  const [expCat, cattleBuy, cattleSell, openBal, closeBal, partnerShares, payroll] =
    await Promise.all([
      pool.query(
        `SELECT ec.name as category, COALESCE(SUM(e.amount),0) as total
       FROM expenses e JOIN expense_categories ec ON ec.id=e.category_id
       WHERE e.deleted_at IS NULL AND e.expense_date BETWEEN $1 AND $2
       GROUP BY ec.name ORDER BY total DESC`,
        [from_date, to_date],
      ),
      pool.query(
        `SELECT COUNT(*) as count, COALESCE(SUM(purchase_price),0) as total
       FROM cattle WHERE purchase_date BETWEEN $1 AND $2`,
        [from_date, to_date],
      ),
      pool.query(
        `SELECT COUNT(*) as count, COALESCE(SUM(sale_price),0) as total,
              COALESCE(SUM(sale_price-purchase_price),0) as net_profit
       FROM cattle WHERE is_sold=TRUE AND sale_date BETWEEN $1 AND $2`,
        [from_date, to_date],
      ),
      pool.query(
        `SELECT amount FROM bank_balance WHERE updated_at<=$1 ORDER BY updated_at DESC LIMIT 1`,
        [from_date],
      ),
      pool.query(
        `SELECT amount FROM bank_balance WHERE updated_at<=$1 ORDER BY updated_at DESC LIMIT 1`,
        [`${to_date} 23:59:59`],
      ),
      pool.query(
        `SELECT u.name, COALESCE(SUM(ps.share_amount),0) as total_share
       FROM users u
       LEFT JOIN partner_shares ps ON ps.partner_id=u.id
       LEFT JOIN expenses e ON e.id=ps.expense_id AND e.deleted_at IS NULL
         AND e.expense_date BETWEEN $1 AND $2
       WHERE u.role IN ('super_admin','partner')
       GROUP BY u.id,u.name ORDER BY u.name`,
        [from_date, to_date],
      ),
      pool.query(
        `SELECT e.name, pr.base_salary, pr.total_expenses, pr.total_cost
       FROM payroll_records pr JOIN employees e ON e.id=pr.employee_id
       WHERE pr.month BETWEEN $1 AND $2`,
        [from_date, to_date],
      ),
    ]);

  return {
    period: { from_date, to_date },
    expenses_by_category: expCat.rows,
    cattle: {
      purchases: {
        count: parseInt(cattleBuy.rows[0].count),
        total: parseFloat(cattleBuy.rows[0].total),
      },
      sales: {
        count: parseInt(cattleSell.rows[0].count),
        total: parseFloat(cattleSell.rows[0].total),
        net_profit: parseFloat(cattleSell.rows[0].net_profit),
      },
    },
    bank_balance: {
      opening: parseFloat(openBal.rows[0]?.amount || '0'),
      closing: parseFloat(closeBal.rows[0]?.amount || '0'),
    },
    partner_shares: partnerShares.rows,
    payroll: payroll.rows,
  };
}

type ReportData = Awaited<ReturnType<typeof getReportData>>;

async function generatePDF(data: ReportData): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PdfPrinter = require('pdfmake');
  const fmt = (n: number) => `PKR ${n.toLocaleString('en-PK')}`;
  const fonts = {
    Roboto: {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique',
    },
  };
  const printer = new PdfPrinter(fonts);
  const docDef = {
    pageSize: 'A4',
    content: [
      { text: 'Zavvar Cattle Farm (ZCF)', style: 'header', alignment: 'center' },
      {
        text: `Report: ${data.period.from_date} to ${data.period.to_date}`,
        style: 'subheader',
        alignment: 'center',
      },
      {
        text: `Generated: ${new Date().toLocaleDateString('en-PK')}`,
        style: 'small',
        alignment: 'center',
        margin: [0, 0, 0, 20],
      },
      { text: 'Bank Balance', style: 'section' },
      {
        table: {
          widths: ['*', '*'],
          body: [
            ['Opening', 'Closing'],
            [fmt(data.bank_balance.opening), fmt(data.bank_balance.closing)],
          ],
        },
      },
      { text: '', margin: [0, 10] },
      { text: 'Expenses by Category', style: 'section' },
      {
        table: {
          widths: ['*', 'auto'],
          body: [
            ['Category', 'Amount'],
            ...data.expenses_by_category.map((e: { category: string; total: string }) => [
              e.category,
              fmt(parseFloat(e.total)),
            ]),
          ],
        },
      },
      { text: '', margin: [0, 10] },
      { text: 'Cattle Transactions', style: 'section' },
      {
        table: {
          widths: ['*', 'auto', 'auto'],
          body: [
            ['Type', 'Count', 'Total'],
            ['Purchases', data.cattle.purchases.count, fmt(data.cattle.purchases.total)],
            ['Sales', data.cattle.sales.count, fmt(data.cattle.sales.total)],
            ['Net Profit', '', fmt(data.cattle.sales.net_profit)],
          ],
        },
      },
      { text: '', margin: [0, 10] },
      { text: 'Partner Shares', style: 'section' },
      {
        table: {
          widths: ['*', 'auto'],
          body: [
            ['Partner', 'Share'],
            ...data.partner_shares.map((p: { name: string; total_share: string }) => [
              p.name,
              fmt(parseFloat(p.total_share)),
            ]),
          ],
        },
      },
      ...(data.payroll.length > 0
        ? [
            { text: '', margin: [0, 10] },
            { text: 'Payroll', style: 'section' },
            {
              table: {
                widths: ['*', 'auto', 'auto', 'auto'],
                body: [
                  ['Employee', 'Salary', 'Expenses', 'Total'],
                  ...data.payroll.map(
                    (p: {
                      name: string;
                      base_salary: string;
                      total_expenses: string;
                      total_cost: string;
                    }) => [
                      p.name,
                      fmt(parseFloat(p.base_salary)),
                      fmt(parseFloat(p.total_expenses)),
                      fmt(parseFloat(p.total_cost)),
                    ],
                  ),
                ],
              },
            },
          ]
        : []),
    ],
    styles: {
      header: { fontSize: 18, bold: true, margin: [0, 10, 0, 5] },
      subheader: { fontSize: 12, margin: [0, 0, 0, 5] },
      small: { fontSize: 10, color: '#666' },
      section: { fontSize: 13, bold: true, margin: [0, 15, 0, 5], color: '#166534' },
    },
    footer: {
      text: 'Generated by Zavvar Cattle Farm (ZCF)',
      alignment: 'center',
      fontSize: 9,
      color: '#666',
    },
  };
  return new Promise((resolve, reject) => {
    const doc = printer.createPdfKitDocument(docDef);
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

export const reportsIndex: HandlerModule = {
  async GET(req) {
    await requireAuth(req);
    const q = queryParams(req);
    const type = (q.type || 'monthly') as 'weekly' | 'monthly';
    const param =
      type === 'weekly'
        ? q.week || `${new Date().getFullYear()}-W01`
        : q.month || new Date().toISOString().slice(0, 7);
    const { from_date, to_date } = getDateRange(type, param);
    const data = await getReportData(from_date, to_date);

    if (q.pdf === '1') {
      const pdfBuffer = await generatePDF(data);
      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="zcf-report-${param}.pdf"`,
        },
      });
    }

    return NextResponse.json(data);
  },
};
