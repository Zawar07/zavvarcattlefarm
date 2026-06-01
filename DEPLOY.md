# Deploy on Vercel (Hobby plan)

1. Import [github.com/Zawar07/zavvarcattlefarm](https://github.com/Zawar07/zavvarcattlefarm) on Vercel.
2. Set **Root Directory** to `zcf-next` (Project Settings → General).
3. Add environment variables (Production + Preview):

| Variable | Required |
|----------|----------|
| `DATABASE_URL` or `POSTGRES_URL` | Yes — Supabase pooler URL |
| `JWT_SECRET` or `SUPABASE_JWT_SECRET` | Yes |
| `BLOB_READ_WRITE_TOKEN` | Yes — for receipt/cattle uploads |

4. Connect **Vercel Blob** storage (optional; can use token env only).
5. Deploy. Run `supabase/migrations/001_schema.sql` in Supabase SQL Editor, then `npm run seed` locally once.

Hobby limits: API routes use `nodejs` runtime with `maxDuration: 10` seconds (see `src/app/api/layout.ts`).
