import type { Request, Response, NextFunction } from 'express';
import { JwtService } from '../services/jwtService.js';
import { TenantResolver } from '../services/tenantResolver.js';
import type { JwtUserPayload, TenantContext } from '../types/auth.js';

interface AuthenticatedRequest extends Request {
  tokenPayload?: JwtUserPayload;
  tenantContext?: TenantContext;
}

/**
 * Middleware: Extract and verify JWT Bearer token
 */
export function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      success: false,
      message: 'Access denied: Authorization header is missing',
    });
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    res.status(401).json({
      success: false,
      message: 'Access denied: Token must follow Bearer format (Authorization: Bearer <token>)',
    });
    return;
  }

  const token = parts[1];

  try {
    const payload = JwtService.verifyToken(token);
    req.tokenPayload = payload;
    next();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid token';
    res.status(401).json({
      success: false,
      message: msg,
    });
  }
}

/**
 * Middleware: Resolve tenant database and validate user in tenant database
 */
export async function resolveTenantDatabase(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const payload = req.tokenPayload;

  if (!payload || !payload.sub || !payload.company_id || !payload.company_code) {
    res.status(401).json({
      success: false,
      message: 'Authentication context is missing or invalid',
    });
    return;
  }

  try {
    // 1. Resolve company, verify active status, verify subscription, and get tenant pool
    const { company, dbConfig, pool } = await TenantResolver.resolveByCompanyId(
      payload.company_id,
      payload.company_code
    );

    // 2. Validate user in the tenant database
    const userRes = await pool.query<{
      u_user_id: string;
      u_employee_id: string | null;
      c_email: string;
      c_user_status: string;
      b_is_active: boolean;
    }>(
      `SELECT u_user_id, u_employee_id, c_email, c_user_status, b_is_active
       FROM public.tbl_user_mst
       WHERE u_user_id = $1
       LIMIT 1;`,
      [payload.sub]
    );

    if (userRes.rows.length === 0) {
      res.status(401).json({
        success: false,
        message: 'Authenticated user record does not exist in tenant database',
      });
      return;
    }

    const user = userRes.rows[0];

    if (!user.b_is_active || user.c_user_status.toUpperCase() !== 'ACTIVE') {
      res.status(401).json({
        success: false,
        message: 'User account is deactivated or suspended in tenant database',
      });
      return;
    }

    // 3. Query current active roles from tenant database
    const roleRes = await pool.query<{ c_role_code: string }>(
      `SELECT r.c_role_code
       FROM public.tbl_user_role_map urm
       JOIN public.tbl_role_mst r ON urm.u_role_id = r.u_role_id
       WHERE urm.u_user_id = $1
         AND urm.b_is_active = TRUE
         AND r.b_is_active = TRUE;`,
      [user.u_user_id]
    );
    const activeRoles = roleRes.rows.map((r) => r.c_role_code);

    // 4. Query current active permissions from tenant database
    const permRes = await pool.query<{ c_permission_code: string }>(
      `SELECT DISTINCT p.c_permission_code
       FROM public.tbl_user_role_map urm
       JOIN public.tbl_role_permission_map rpm ON urm.u_role_id = rpm.u_role_id
       JOIN public.tbl_permission_mst p ON rpm.u_permission_id = p.u_permission_id
       WHERE urm.u_user_id = $1
         AND urm.b_is_active = TRUE
         AND rpm.b_is_active = TRUE
         AND p.b_is_active = TRUE;`,
      [user.u_user_id]
    );
    const activePermissions = permRes.rows.map((p) => p.c_permission_code);

    // 5. Query employee designation if employee exists
    let designation = null;
    if (user.u_employee_id) {
      const empRes = await pool.query<{
        u_employee_id: string;
        u_designation_id: string | null;
        c_designation_code: string | null;
        c_designation_name: string | null;
      }>(
        `SELECT 
           e.u_employee_id, 
           e.u_designation_id, 
           d.c_designation_code, 
           d.c_designation_name
         FROM public.tbl_employee_mst e
         LEFT JOIN public.tbl_designation_mst d 
           ON e.u_designation_id = d.u_designation_id AND d.b_is_active = TRUE
         WHERE e.u_employee_id = $1
           AND e.b_is_active = TRUE
         LIMIT 1;`,
        [user.u_employee_id]
      );

      if (empRes.rows.length > 0 && empRes.rows[0].c_designation_code) {
        designation = {
          id: empRes.rows[0].u_designation_id!,
          code: empRes.rows[0].c_designation_code,
          name: empRes.rows[0].c_designation_name || '',
        };
      }
    }

    // 6. Attach typed tenant context to request
    req.tenantContext = {
      user: {
        userId: user.u_user_id,
        email: user.c_email,
        employeeId: user.u_employee_id,
        designation,
        roles: activeRoles,
        permissions: activePermissions,
      },
      tenant: {
        companyId: company.u_company_id,
        companyCode: company.c_company_code,
        companyName: company.c_company_name,
        databaseName: dbConfig.c_database_name,
      },
      db: pool,
    };

    next();
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[resolveTenantDatabase Error]:', errorMsg);

    // Determine appropriate status code
    if (
      errorMsg.includes('inactive or suspended') ||
      errorMsg.includes('expired') ||
      errorMsg.includes('No active subscription')
    ) {
      res.status(403).json({
        success: false,
        message: errorMsg,
      });
      return;
    }

    if (errorMsg.includes('not found') || errorMsg.includes('does not exist')) {
      res.status(401).json({
        success: false,
        message: errorMsg,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Failed to establish tenant context',
      error: errorMsg,
    });
  }
}

/**
 * Reusable permission authorization middleware
 * Example: requirePermission('employee.view')
 */
export function requirePermission(permissionCode: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.tenantContext) {
      res.status(401).json({
        success: false,
        message: 'Authentication context required for permission verification',
      });
      return;
    }

    const userPermissions = req.tenantContext.user.permissions;
    if (!userPermissions.includes(permissionCode)) {
      res.status(403).json({
        success: false,
        message: `Forbidden: User lacks required permission "${permissionCode}"`,
      });
      return;
    }

    next();
  };
}
