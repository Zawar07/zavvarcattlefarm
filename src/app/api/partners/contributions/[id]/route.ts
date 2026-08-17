import { withHandler } from '@/lib/http';
import * as handlers from '@/lib/handlers';
import { methodNotAllowedResponse } from '@/lib/handlers';

export const dynamic = 'force-dynamic';

export const PATCH = withHandler(async (req, ctx) => {
  const h = handlers.partnerContributionById.PATCH;
  return h ? h(req, ctx) : methodNotAllowedResponse();
});
export const DELETE = withHandler(async (req, ctx) => {
  const h = handlers.partnerContributionById.DELETE;
  return h ? h(req, ctx) : methodNotAllowedResponse();
});
