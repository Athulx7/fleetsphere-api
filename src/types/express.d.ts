import type { TenantContext } from './auth.js';

declare global {
  namespace Express {
    interface Request {
      tenantContext?: TenantContext;
    }
  }
}

export {};
