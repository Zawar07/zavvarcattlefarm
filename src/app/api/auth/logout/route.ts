import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireAuth, clearAuthCookie } from '@/lib/auth';
import { handleError, methodNotAllowed } from '@/lib/http';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    await getPool().query('UPDATE sessions SET invalidated = TRUE WHERE id = $1', [
      user.sessionId,
    ]);
    const res = NextResponse.json({ message: 'Logged out successfully.' });
    clearAuthCookie(res);
    return res;
  } catch (err) {
    return handleError(err);
  }
}

export function GET() {
  return methodNotAllowed();
}
