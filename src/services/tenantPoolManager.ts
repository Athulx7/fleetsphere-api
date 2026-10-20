import pg from 'pg';
import type { TenantDatabaseConfigRecord } from '../types/auth.js';
import type { DatabaseCredentials } from './secretManager.js';
import { ENV } from '../config/env.js';

const { Pool } = pg;

export class TenantPoolManager {
  private static pools: Map<string, pg.Pool> = new Map();
  private static pendingInitializations: Map<string, Promise<pg.Pool>> = new Map();

  /**
   * Generates a deterministic key for the tenant database pool
   */
  private static getPoolKey(
    host: string,
    port: number,
    database: string,
    user: string
  ): string {
    return `${host.toLowerCase()}:${port}/${database.toLowerCase()}@${user}`;
  }

  /**
   * Retrieves or initializes a connection pool for the given tenant database configuration
   */
  public static async getPool(
    dbConfig: TenantDatabaseConfigRecord,
    credentials: DatabaseCredentials
  ): Promise<pg.Pool> {
    const host = dbConfig.c_database_host || ENV.TENANT_DB_DEFAULTS.HOST;
    const port = dbConfig.n_database_port || ENV.TENANT_DB_DEFAULTS.PORT;
    const database = dbConfig.c_database_name;
    const user = credentials.user;
    const password = credentials.password;

    if (!database) {
      throw new Error('Tenant database name is not defined in configuration');
    }

    const poolKey = this.getPoolKey(host, port, database, user);

    // 1. Return existing initialized pool
    const existingPool = this.pools.get(poolKey);
    if (existingPool) {
      return existingPool;
    }

    // 2. Prevent race condition: if initialization is already in progress, reuse the promise
    const pending = this.pendingInitializations.get(poolKey);
    if (pending) {
      return pending;
    }

    // 3. Create new pool promise
    const initPromise = (async () => {
      try {
        const isSsl = dbConfig.c_ssl_mode && dbConfig.c_ssl_mode.toLowerCase() === 'require';

        const pool = new Pool({
          host,
          port,
          database,
          user,
          password,
          ssl: isSsl ? { rejectUnauthorized: false } : false,
          max: ENV.TENANT_DB_DEFAULTS.MAX_CONNECTIONS,
          idleTimeoutMillis: ENV.TENANT_DB_DEFAULTS.IDLE_TIMEOUT_MS,
          connectionTimeoutMillis: ENV.TENANT_DB_DEFAULTS.CONNECTION_TIMEOUT_MS,
        });

        // Set error handler for idle clients to avoid unhandled process crashes
        pool.on('error', (err) => {
          console.error(`[Tenant Pool Error] [${poolKey}]:`, err.message);
        });

        // Verify connection with quick probe
        const client = await pool.connect();
        try {
          await client.query('SELECT 1;');
        } finally {
          client.release();
        }

        console.log(`[Tenant Pool Manager] Initialized and verified pool for [${poolKey}]`);
        this.pools.set(poolKey, pool);
        return pool;
      } catch (err) {
        console.error(`[Tenant Pool Manager] Failed to connect to tenant database [${poolKey}]:`, err);
        throw new Error(
          `Unable to establish connection to tenant database: ${err instanceof Error ? err.message : String(err)}`
        );
      } finally {
        this.pendingInitializations.delete(poolKey);
      }
    })();

    this.pendingInitializations.set(poolKey, initPromise);
    return initPromise;
  }

  /**
   * Returns current active pool count
   */
  public static getActivePoolCount(): number {
    return this.pools.size;
  }

  /**
   * Gracefully close all tenant pools
   */
  public static async closeAll(): Promise<void> {
    console.log(`[Tenant Pool Manager] Closing ${this.pools.size} active tenant pools...`);
    const closePromises = Array.from(this.pools.entries()).map(async ([key, pool]) => {
      try {
        await pool.end();
        console.log(`[Tenant Pool Manager] Closed pool for [${key}]`);
      } catch (err) {
        console.error(`[Tenant Pool Manager] Error closing pool [${key}]:`, err);
      }
    });

    await Promise.allSettled(closePromises);
    this.pools.clear();
    console.log('[Tenant Pool Manager] All tenant pools closed.');
  }
}
