import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const adminPool = new Pool({ connectionString: process.env.ADMIN_DATABASE_URL })

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
