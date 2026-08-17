import { withHandler } from '@/lib/http';
import * as handlers from '@/lib/handlers';
import { methodNotAllowedResponse } from '@/lib/handlers';

export const dynamic = 'force-dynamic';

export const GET = withHandler(async (req, ctx) => {
  const h = handlers.partnerContributions.GET;
  return h ? h(req, ctx) : methodNotAllowedResponse();
});
export const POST = withHandler(async (req, ctx) => {
  const h = handlers.partnerContributions.POST;
  return h ? h(req, ctx) : methodNotAllowedResponse();
});
