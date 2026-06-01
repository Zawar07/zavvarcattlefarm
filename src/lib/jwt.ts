import jwt from 'jsonwebtoken';

export const COOKIE_NAME = 'zcf_token';

const JWT_SECRET =
  process.env.JWT_SECRET ||
  process.env.SUPABASE_JWT_SECRET ||
  'zcf-dev-secret-change-in-production';

export interface JwtPayload {
  sub: string;
  role: string;
  name: string;
  sessionId: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30m', algorithm: 'HS256' });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
