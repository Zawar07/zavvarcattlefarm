# ZCF Next.js

Next.js port of **Zavvar Cattle Farm (ZCF)** — mobile-first farm financial manager.

- **Frontend:** Next.js 15 App Router, React 19, Tailwind CSS 4
- **Database:** Supabase PostgreSQL (same schema as the original app)
- **Storage:** Vercel Blob for receipt and cattle images
- **Auth:** JWT cookie sessions (compatible with existing `users` / `sessions` tables)

## Setup

1. Copy `.env.example` to `.env.local` and fill in values from Supabase and Vercel.
2. Run the SQL migration in Supabase SQL Editor: `supabase/migrations/001_schema.sql`
3. Seed default users and categories:

```bash
npm install
npx tsx scripts/seed.ts
```

4. Start dev server:

```bash
npm run dev
```

## Deploy (Vercel Hobby)

See [DEPLOY.md](./DEPLOY.md). In the Vercel project, set **Root Directory** to `zcf-next`.

Required env vars: `DATABASE_URL` (or `POSTGRES_URL`), `JWT_SECRET`, `BLOB_READ_WRITE_TOKEN`.

## Project layout

```
zcf-next/
├── src/app/          # Next.js routes (pages + /api)
├── src/pages/        # UI screens (ported from Vite client)
├── src/lib/          # DB, auth, blob, API handlers
└── supabase/         # SQL migrations
```

The original Vite + Vercel serverless app remains in the parent repo unchanged.
