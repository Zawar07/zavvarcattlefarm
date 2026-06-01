import { NextRequest, NextResponse } from 'next/server';
import { parse as parseCookies } from 'cookie';
import { verifyToken, COOKIE_NAME, type JwtPayload } from './jwt';
import { getPool } from './db';
import { AppError } from './errors';

export interface AuthUser {
  id: string;
  name: string;
  role: string;
  phone_number: string;
  sessionId: string;
}

export async function requireAuth(req: NextRequest): Promise<AuthUser> {
  const cookieHeader = req.headers.get('cookie') || '';
  const cookies = parseCookies(cookieHeader);
  const token = cookies[COOKIE_NAME];

  if (!token) throw new AppError(401, 'AUTH_REQUIRED', 'Authentication required.');

  let payload: JwtPayload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new AppError(401, 'AUTH_REQUIRED', 'Invalid or expired token.');
  }

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT s.id, s.last_activity, s.invalidated,
            u.id as user_id, u.name, u.role, u.phone_number, u.is_active
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = $1`,
    [payload.sessionId],
  );

  if (!rows[0] || rows[0].invalidated) {
    throw new AppError(401, 'AUTH_REQUIRED', 'Session not found or invalidated.');
  }
  if (!rows[0].is_active) {
    throw new AppError(401, 'AUTH_REQUIRED', 'Account is deactivated.');
  }

  const diffMinutes =
    (Date.now() - new Date(rows[0].last_activity).getTime()) / 60000;
  if (diffMinutes > 30) {
    await pool.query('UPDATE sessions SET invalidated = TRUE WHERE id = $1', [
      payload.sessionId,
    ]);
    throw new AppError(401, 'SESSION_EXPIRED', 'Session expired due to inactivity.');
  }

  pool
    .query('UPDATE sessions SET last_activity = NOW() WHERE id = $1', [
      payload.sessionId,
    ])
    .catch(() => {});

  return {
    id: rows[0].user_id,
    name: rows[0].name,
    role: rows[0].role,
    phone_number: rows[0].phone_number,
    sessionId: payload.sessionId,
  };
}

export function requireSuperAdmin(user: AuthUser): void {
  if (user.role !== 'super_admin') {
    throw new AppError(403, 'FORBIDDEN', 'Super Admin access required.');
  }
}

export function setAuthCookie(res: NextResponse, token: string): void {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 30 * 60,
    path: '/',
  });
}

export function clearAuthCookie(res: NextResponse): void {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 0,
    path: '/',
  });
}
