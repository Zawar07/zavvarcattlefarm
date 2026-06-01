import { withHandler } from '@/lib/http';
import * as handlers from '@/lib/handlers';
import { methodNotAllowedResponse } from '@/lib/handlers';

export const GET = withHandler(async (req, ctx) => {
  const h = handlers.bankLog.GET;
  return h ? h(req, ctx) : methodNotAllowedResponse();
});
export const POST = withHandler(async (req, ctx) => {
  const h = handlers.bankLog.POST;
  return h ? h(req, ctx) : methodNotAllowedResponse();
});
export const PATCH = withHandler(async (req, ctx) => {
  const h = handlers.bankLog.PATCH;
  return h ? h(req, ctx) : methodNotAllowedResponse();
});
export const DELETE = withHandler(async (req, ctx) => {
  const h = handlers.bankLog.DELETE;
  return h ? h(req, ctx) : methodNotAllowedResponse();
});
