import { withHandler } from '@/lib/http';
import * as handlers from '@/lib/handlers';
import { methodNotAllowedResponse } from '@/lib/handlers';

export const GET = withHandler(async (req, ctx) => {
  const h = handlers.employeeExpenses.GET;
  return h ? h(req, ctx) : methodNotAllowedResponse();
});
export const POST = withHandler(async (req, ctx) => {
  const h = handlers.employeeExpenses.POST;
  return h ? h(req, ctx) : methodNotAllowedResponse();
});
export const PATCH = withHandler(async (req, ctx) => {
  const h = handlers.employeeExpenses.PATCH;
  return h ? h(req, ctx) : methodNotAllowedResponse();
});
export const DELETE = withHandler(async (req, ctx) => {
  const h = handlers.employeeExpenses.DELETE;
  return h ? h(req, ctx) : methodNotAllowedResponse();
});
