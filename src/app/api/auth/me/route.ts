import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { handleError, methodNotAllowed } from '@/lib/http';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    return NextResponse.json({ user });
  } catch (err) {
    return handleError(err);
  }
}

export function POST() {
  return methodNotAllowed();
}
