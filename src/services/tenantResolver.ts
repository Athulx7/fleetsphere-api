import type pg from 'pg';
import { adminPool } from '../config/adminDb.js';
import { SecretManager } from './secretManager.js';
import { TenantPoolManager } from './tenantPoolManager.js';
import type {
  CompanyRecord,
  SubscriptionRecord,
  TenantDatabaseConfigRecord,
  TenantResolvedInfo,
} from '../types/auth.js';

export interface ResolvedTenant {
  company: CompanyRecord;
  subscription: SubscriptionRecord;
  dbConfig: TenantDatabaseConfigRecord;
  pool: pg.Pool;
}

export class TenantResolver {
  // Short-lived cache (30 seconds) to avoid slamming Admin DB on rapid sequential requests
  // while ensuring subscription or status changes take effect quickly
  private static cache: Map<
    string,
    { resolved: ResolvedTenant; cachedAt: number }
  > = new Map();
  private static CACHE_TTL_MS = 30 * 1000; // 30 seconds

  /**
   * Invalidate cache for a specific company or completely
   */
  public static invalidateCache(companyKey?: string): void {
    if (companyKey) {
      this.cache.delete(companyKey.toUpperCase());
    } else {
      this.cache.clear();
    }
  }

  /**
   * Resolves tenant metadata and pool using company code (for login)
   */
  public static async resolveByCompanyCode(companyCode: string): Promise<ResolvedTenant> {
    if (!companyCode || !companyCode.trim()) {
      throw new Error('Company code is required');
    }

    const cacheKey = `CODE:${companyCode.trim().toUpperCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.resolved;
    }

    // 1. Find company in Admin DB
    const compRes = await adminPool.query<CompanyRecord>(
      `SELECT u_company_id, c_company_code, c_company_name, c_status, b_is_active
       FROM public.tbl_company_master
       WHERE UPPER(c_company_code) = UPPER($1)
       LIMIT 1;`,
      [companyCode.trim()]
    );

    if (compRes.rows.length === 0) {
      throw new Error(`Company with code "${companyCode}" not found`);
    }

    const company = compRes.rows[0];
    return this.validateAndResolve(company, cacheKey);
  }

  /**
   * Resolves tenant metadata and pool using verified company UUID (for authenticated requests)
   */
  public static async resolveByCompanyId(
    companyId: string,
    expectedCompanyCode?: string
  ): Promise<ResolvedTenant> {
    if (!companyId || !companyId.trim()) {
      throw new Error('Company ID is required');
    }

    const cacheKey = `ID:${companyId.trim()}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      // If expected company code is given, verify it matches cached value
      if (
        expectedCompanyCode &&
        cached.resolved.company.c_company_code.toUpperCase() !==
          expectedCompanyCode.trim().toUpperCase()
      ) {
        throw new Error('Token company code does not match company record');
      }
      return cached.resolved;
    }

    // 1. Query company in Admin DB
    const compRes = await adminPool.query<CompanyRecord>(
      `SELECT u_company_id, c_company_code, c_company_name, c_status, b_is_active
       FROM public.tbl_company_master
       WHERE u_company_id = $1
       LIMIT 1;`,
      [companyId.trim()]
    );

    if (compRes.rows.length === 0) {
      throw new Error('Company not found in central registry');
    }

    const company = compRes.rows[0];

    // Ensure company code matches if provided
    if (
      expectedCompanyCode &&
      company.c_company_code.toUpperCase() !==
        expectedCompanyCode.trim().toUpperCase()
    ) {
      throw new Error('Token company code does not match company record');
    }

    return this.validateAndResolve(company, cacheKey);
  }

  /**
   * Performs full company validation, subscription verification, database config resolution, and pool acquisition
   */
  private static async validateAndResolve(
    company: CompanyRecord,
    cacheKey: string
  ): Promise<ResolvedTenant> {
    // 2. Verify company is active
    if (!company.b_is_active || company.c_status.toLowerCase() !== 'active') {
      throw new Error(`Company "${company.c_company_code}" is inactive or suspended`);
    }

    // 3. Verify subscription
    const subRes = await adminPool.query<SubscriptionRecord>(
      `SELECT 
         s.u_subscription_id, 
         s.u_company_id, 
         s.u_plan_id, 
         s.c_subscription_status, 
         s.d_start_date, 
         s.d_end_date, 
         s.d_trial_end_date, 
         s.b_is_active,
         p.c_plan_code,
         p.c_plan_name
       FROM public.tbl_tenant_subscriptions s
       JOIN public.tbl_subscription_plans p ON s.u_plan_id = p.u_plan_id
       WHERE s.u_company_id = $1
         AND s.b_is_active = TRUE
         AND p.b_is_active = TRUE
       ORDER BY s.d_created_at DESC
       LIMIT 1;`,
      [company.u_company_id]
    );

    if (subRes.rows.length === 0) {
      throw new Error(`No active subscription found for company "${company.c_company_code}"`);
    }

    const subscription = subRes.rows[0];

    // Check status
    const validStatuses = ['active', 'trial'];
    if (!validStatuses.includes(subscription.c_subscription_status.toLowerCase())) {
      throw new Error(
        `Subscription for company "${company.c_company_code}" is ${subscription.c_subscription_status}`
      );
    }

    // Check expiration date
    if (subscription.d_end_date) {
      const expiry = new Date(subscription.d_end_date);
      // Normalize to end of the day or direct comparison
      if (expiry.getTime() < Date.now()) {
        throw new Error(`Subscription for company "${company.c_company_code}" has expired`);
      }
    }

    // 4. Retrieve database config
    const dbConfigRes = await adminPool.query<TenantDatabaseConfigRecord>(
      `SELECT 
         u_database_config_id, 
         u_company_id, 
         c_database_name, 
         c_database_host, 
         n_database_port, 
         c_database_schema, 
         c_database_mode, 
         c_ssl_mode, 
         c_secret_reference, 
         c_provisioning_status, 
         b_is_active
       FROM public.tbl_tenant_database_config
       WHERE u_company_id = $1
       LIMIT 1;`,
      [company.u_company_id]
    );

    if (dbConfigRes.rows.length === 0) {
      throw new Error(`Database configuration not found for company "${company.c_company_code}"`);
    }

    const dbConfig = dbConfigRes.rows[0];

    if (!dbConfig.b_is_active) {
      throw new Error(`Database configuration for company "${company.c_company_code}" is disabled`);
    }

    if (dbConfig.c_provisioning_status.toUpperCase() !== 'READY') {
      throw new Error(
        `Database for company "${company.c_company_code}" is not ready (status: ${dbConfig.c_provisioning_status})`
      );
    }

    // 5. Resolve credentials using SecretManager
    const credentials = SecretManager.resolveSecret(dbConfig.c_secret_reference);

    // 6. Acquire or reuse connection pool from TenantPoolManager
    const pool = await TenantPoolManager.getPool(dbConfig, credentials);

    const resolved: ResolvedTenant = {
      company,
      subscription,
      dbConfig,
      pool,
    };

    // Store in cache
    this.cache.set(cacheKey, { resolved, cachedAt: Date.now() });
    return resolved;
  }
}
