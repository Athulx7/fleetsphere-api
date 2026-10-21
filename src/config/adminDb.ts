import pg from 'pg';
import dotenv from 'dotenv';
import { ENV } from './env.js';

dotenv.config();

const { Pool } = pg;

// Use ADMIN_DATABASE_URL from process.env, or build from ADMIN_DB_* vars, or fallback to ENV.ADMIN_DATABASE_URL
export const adminPool = process.env.ADMIN_DATABASE_URL
  ? new Pool({ connectionString: process.env.ADMIN_DATABASE_URL })
  : process.env.ADMIN_DB_PASSWORD
  ? new Pool({
      host: process.env.ADMIN_DB_HOST || 'localhost',
      port: Number(process.env.ADMIN_DB_PORT) || 5432,
      database: process.env.ADMIN_DB_NAME || 'fleetsphere_admin',
      user: process.env.ADMIN_DB_USER || 'postgres',
      password: String(process.env.ADMIN_DB_PASSWORD),
    })
  : new Pool({ connectionString: ENV.ADMIN_DATABASE_URL });

adminPool.on('error', (err) => {
  console.error('[Admin DB] Unexpected error on idle client:', err.message);
});

/**
 * Tests connection to the Admin PostgreSQL Database
 */
export async function testAdminDbConnection(): Promise<{
  success: boolean;
  database?: string;
  serverTime?: string;
  error?: string;
}> {
  try {
    const result = await adminPool.query(
      'SELECT current_database() as database, NOW() as server_time'
    );
    const row = result.rows[0];
    console.log(
      `[Admin DB] Connected successfully to database: "${row.database}" at ${row.server_time}`
    );
    return {
      success: true,
      database: row.database,
      serverTime: row.server_time,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Admin DB] Connection failed: ${errorMsg}`);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Execute a query on the Admin DB
 */
export async function queryAdminDb(text: string, params?: unknown[]) {
  const start = Date.now();
  const res = await adminPool.query(text, params);
  const duration = Date.now() - start;
  return { ...res, duration };
}
