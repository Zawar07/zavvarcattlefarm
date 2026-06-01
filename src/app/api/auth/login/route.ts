import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { getPool } from '@/lib/db';
import { signToken } from '@/lib/jwt';
import { AppError } from '@/lib/errors';
import { handleError, parseJsonBody, methodNotAllowed } from '@/lib/http';
import { setAuthCookie } from '@/lib/auth';

export const runtime = 'nodejs';

const PHONE_REGEX = /^03\d{9}$/;

export async function POST(req: NextRequest) {
  try {
    const { phone_number, password } = await parseJsonBody<{
      phone_number?: string;
      password?: string;
    }>(req);
    if (!phone_number || !password) {
      throw new AppError(400, 'VALIDATION_MISSING_FIELDS', 'Phone number and password are required.');
    }
    if (!PHONE_REGEX.test(phone_number)) {
      throw new AppError(400, 'VALIDATION_PHONE_FORMAT', 'Phone must be 03XXXXXXXXX.');
    }

    const pool = getPool();
    const { rows } = await pool.query(
      'SELECT id, name, role, phone_number, password_hash, is_active FROM users WHERE phone_number = $1',
      [phone_number],
    );
    if (!rows[0]) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid phone number or password.');
    if (!rows[0].is_active) {
      throw new AppError(401, 'ACCOUNT_DEACTIVATED', 'This account has been deactivated.');
    }

    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid phone number or password.');

    const { rows: sess } = await pool.query(
      'INSERT INTO sessions (user_id) VALUES ($1) RETURNING id',
      [rows[0].id],
    );

    const token = signToken({
      sub: rows[0].id,
      role: rows[0].role,
      name: rows[0].name,
      sessionId: sess[0].id,
    });

    const res = NextResponse.json({
      user: {
        id: rows[0].id,
        name: rows[0].name,
        role: rows[0].role,
        phone_number: rows[0].phone_number,
      },
    });
    setAuthCookie(res, token);
    return res;
  } catch (err) {
    return handleError(err);
  }
}

export function GET() {
  return methodNotAllowed();
}
