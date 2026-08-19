import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seedAdmin() {
  const email = "habib.rahman.it@gmail.com";
  const name = "Super Admin";

  console.log(`⏳ Connecting to Neon PostgreSQL for ${email}...`);

  try {
    // 1. Ensure Enum Type Exists
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MODERATOR');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // 2. Insert/Upsert Super Admin
    const query = `
      INSERT INTO "User" ("id", "name", "email", "role", "isActive", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, $2, 'SUPER_ADMIN'::"Role", true, NOW(), NOW())
      ON CONFLICT ("email") 
      DO UPDATE SET "role" = 'SUPER_ADMIN'::"Role", "isActive" = true, "updatedAt" = NOW()
      RETURNING "id", "email", "role", "isActive";
    `;

    const res = await pool.query(query, [name, email]);
    console.log('✅ Admin user created/activated in Neon DB:', res.rows[0]);
  } catch (err) {
    console.error('❌ Connection or Query Error:', err.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

seedAdmin();