import { NextRequest, NextResponse } from 'next/server';
import { AppError } from './errors';

export function handleError(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: err.statusCode },
    );
  }
  console.error('Unhandled error:', err);
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } },
    { status: 500 },
  );
}

export function methodNotAllowed(): NextResponse {
  return new NextResponse(null, { status: 405 });
}

export async function parseJsonBody<T extends Record<string, unknown>>(
  req: NextRequest,
): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

export function queryParams(req: NextRequest): Record<string, string> {
  const params: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

export type RouteContext = { params: Record<string, string> };

export function withHandler(
  fn: (req: NextRequest, ctx: RouteContext) => Promise<NextResponse>,
) {
  return async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
  ): Promise<NextResponse> => {
    try {
      const params = await context.params;
      return await fn(req, { params });
    } catch (err) {
      return handleError(err);
    }
  };
}
