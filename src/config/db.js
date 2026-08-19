import pkg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/index.js';
import { config } from './env.js';

const { Pool } = pkg;

// Create a pg connection pool using your Neon DATABASE_URL
const pool = new Pool({
  connectionString: config.databaseUrl,
});

// Pass the adapter to PrismaClient
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });