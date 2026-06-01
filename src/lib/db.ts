import { Pool, type PoolConfig } from 'pg';

let pool: Pool | null = null;

function rawConnectionString(): string {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    ''
  );
}

function needsSsl(connectionString: string): boolean {
  return (
    connectionString.includes('supabase') ||
    connectionString.includes('neon.tech') ||
    connectionString.includes('sslmode=')
  );
}

function buildPoolConfig(): PoolConfig {
  let connectionString = rawConnectionString();
  if (!connectionString) {
    throw new Error('DATABASE_URL or POSTGRES_URL is not set');
  }

  const ssl = needsSsl(connectionString);

  // pg v8+ treats sslmode=require as verify-full; uselibpqcompat restores require semantics
  if (ssl && !connectionString.includes('uselibpqcompat')) {
    connectionString += connectionString.includes('?')
      ? '&uselibpqcompat=true'
      : '?uselibpqcompat=true';
  }

  // Windows local dev: Supabase pooler cert chain (do not set ALLOW_INSECURE_DB_TLS on Vercel)
  if (process.env.ALLOW_INSECURE_DB_TLS === '1') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  return {
    connectionString,
    ssl: ssl ? { rejectUnauthorized: false } : undefined,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  };
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(buildPoolConfig());
    pool.on('error', (err) => console.error('Pool error', err));
  }
  return pool;
}
