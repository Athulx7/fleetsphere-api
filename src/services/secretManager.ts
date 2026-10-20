import { ENV } from '../config/env.js';

export interface DatabaseCredentials {
  user: string;
  password: string;
}

export class SecretManager {
  private static registeredSecrets: Map<string, DatabaseCredentials> = new Map();

  /**
   * Register in-memory secret credentials (can be loaded from vault, aws secrets manager, or secure store)
   */
  public static registerSecret(secretRef: string, creds: DatabaseCredentials): void {
    this.registeredSecrets.set(secretRef.trim().toUpperCase(), creds);
  }

  /**
   * Resolves database credentials for a given tenant's secret reference.
   * Checks:
   * 1. Environment variable overrides: TENANT_SECRET_<REF>_USER / TENANT_SECRET_<REF>_PASSWORD
   * 2. Programmatically registered secrets map
   * 3. Default fallback if enabled and reference is valid
   */
  public static resolveSecret(secretRef: string): DatabaseCredentials {
    if (!secretRef || !secretRef.trim()) {
      throw new Error('Tenant secret reference is empty or undefined');
    }

    const cleanRef = secretRef.trim().toUpperCase();

    // 1. Check environment variables: TENANT_SECRET_<REF>_USER / PASSWORD
    const envUser = process.env[`TENANT_SECRET_${cleanRef}_USER`];
    const envPass = process.env[`TENANT_SECRET_${cleanRef}_PASSWORD`];

    if (envUser && envPass) {
      return {
        user: envUser,
        password: envPass,
      };
    }

    // 2. Check registered in-memory secrets
    if (this.registeredSecrets.has(cleanRef)) {
      return this.registeredSecrets.get(cleanRef)!;
    }

    // 3. Fallback to default credentials if reference is recognized (e.g. CLIENTA, CLIENTB)
    // or if a general default tenant credential exists
    if (ENV.TENANT_DB_DEFAULTS.USER && ENV.TENANT_DB_DEFAULTS.PASSWORD) {
      return {
        user: ENV.TENANT_DB_DEFAULTS.USER,
        password: ENV.TENANT_DB_DEFAULTS.PASSWORD,
      };
    }

    throw new Error(`Secret mapping not found for tenant secret reference: "${secretRef}"`);
  }
}
