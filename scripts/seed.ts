import { resolve } from 'path';
import { config } from 'dotenv';
import bcrypt from 'bcrypt';
import { getPool } from '../src/lib/db';

config({ path: resolve(__dirname, '../.env') });

if (process.env.ALLOW_INSECURE_DB_TLS === '1') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

async function seed() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    console.log('Seeding ZCF database...');

    const categories = [
      'Farm General',
      'Feed',
      'Payroll',
      'Electricity',
      'Rent',
      'Veterinary Visit',
      'Vaccination',
      'Medicine & Treatment',
      'Other',
    ];

    for (const cat of categories) {
      await client.query(
        'INSERT INTO expense_categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
        [cat],
      );
    }
    console.log('Expense categories seeded');

    const users = [
      { name: 'Zavvar', phone: '03485157554', password: 'zavvaradmin', role: 'super_admin' },
      { name: 'Danyal', phone: '03418888818', password: 'danyaladmin', role: 'partner' },
      { name: 'Adil', phone: '03358073584', password: 'adiladmin', role: 'partner' },
    ];

    for (const u of users) {
      const hash = await bcrypt.hash(u.password, 12);
      await client.query(
        `INSERT INTO users (name, phone_number, password_hash, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (phone_number) DO NOTHING`,
        [u.name, u.phone, hash, u.role],
      );
      console.log(`User: ${u.name} (${u.phone})`);
    }

    console.log('Seed complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
