import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { TenantResolver } from '../services/tenantResolver.js';
import { JwtService } from '../services/jwtService.js';
import type {
  LoginRequestBody,
  LoginResponseData,
  ApiResponse,
  DesignationClaim,
} from '../types/auth.js';

export class AuthController {
  /**
   * POST /api/auth/login
   */
  public static async login(
    req: Request<unknown, unknown, LoginRequestBody>,
    res: Response<ApiResponse<LoginResponseData>>
  ): Promise<void> {
    const { company_code, email, password } = req.body;

    // 1. Validate request body
    if (!company_code || !company_code.trim()) {
      res.status(400).json({
        success: false,
        message: 'Company code is required',
      });
      return;
    }

    if (!email || !email.trim()) {
      res.status(400).json({
        success: false,
        message: 'Email address is required',
      });
      return;
    }

    if (!password || !password.trim()) {
      res.status(400).json({
        success: false,
        message: 'Password is required',
      });
      return;
    }

    try {
      // 2-8. Resolve company, subscription, database config and connect to tenant DB pool
      let tenant;
      try {
        tenant = await TenantResolver.resolveByCompanyCode(company_code);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.warn(`[Login Failed] Tenant resolution for "${company_code}":`, errorMsg);

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

        if (errorMsg.includes('not found')) {
          res.status(401).json({
            success: false,
            message: 'Invalid company code or credentials',
          });
          return;
        }

        res.status(500).json({
          success: false,
          message: 'Unable to resolve tenant database configuration',
          error: errorMsg,
        });
        return;
      }

      const { company, pool } = tenant;

      // 9-10. Find user in tenant database
      const userRes = await pool.query<{
        u_user_id: string;
        u_employee_id: string | null;
        c_email: string;
        c_password_hash: string;
        c_user_status: string;
        b_is_active: boolean;
      }>(
        `SELECT u_user_id, u_employee_id, c_email, c_password_hash, c_user_status, b_is_active
         FROM public.tbl_user_mst
         WHERE LOWER(c_email) = LOWER($1)
         LIMIT 1;`,
        [email.trim()]
      );

      if (userRes.rows.length === 0) {
        res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
        return;
      }

      const user = userRes.rows[0];

      // 11. Verify user status and password
      if (!user.b_is_active || user.c_user_status.toUpperCase() !== 'ACTIVE') {
        res.status(401).json({
          success: false,
          message: 'User account is inactive or disabled',
        });
        return;
      }

      const isPasswordValid = await bcrypt.compare(password, user.c_password_hash);
      if (!isPasswordValid) {
        res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
        return;
      }

      // Record last login time asynchronously
      pool
        .query('UPDATE public.tbl_user_mst SET d_last_login_at = NOW() WHERE u_user_id = $1;', [
          user.u_user_id,
        ])
        .catch((e) => console.error('[Update Last Login Failed]', e));

      // 12. Retrieve employee designation (if available)
      let designation: DesignationClaim | null = null;
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

      // 13. Retrieve user active roles
      const roleRes = await pool.query<{ c_role_code: string }>(
        `SELECT r.c_role_code
         FROM public.tbl_user_role_map urm
         JOIN public.tbl_role_mst r ON urm.u_role_id = r.u_role_id
         WHERE urm.u_user_id = $1
           AND urm.b_is_active = TRUE
           AND r.b_is_active = TRUE;`,
        [user.u_user_id]
      );
      const roles = roleRes.rows.map((r) => r.c_role_code);

      // 14. Retrieve user active permissions
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
      const permissions = permRes.rows.map((p) => p.c_permission_code);

      // 15. Generate signed JWT
      const token = JwtService.signToken({
        userId: user.u_user_id,
        companyId: company.u_company_id,
        companyCode: company.c_company_code,
        email: user.c_email,
        employeeId: user.u_employee_id,
        designation,
        roles,
        permissions,
      });

      // 16. Return login response
      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          token,
          token_type: 'Bearer',
          expires_in: 3600,
          user: {
            id: user.u_user_id,
            email: user.c_email,
            employee_id: user.u_employee_id,
            designation,
            roles,
            permissions,
          },
          company: {
            id: company.u_company_id,
            code: company.c_company_code,
            name: company.c_company_name,
          },
        },
      });
    } catch (err) {
      console.error('[AuthController.login Uncaught Error]:', err);
      res.status(500).json({
        success: false,
        message: 'An internal error occurred during login',
      });
    }
  }

  /**
   * GET /api/auth/me
   * Returns current authenticated user and tenant profile
   */
  public static async getMe(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
      return;
    }

    const { user, tenant } = req.tenantContext;

    res.status(200).json({
      success: true,
      data: {
        user,
        tenant,
      },
    });
  }

  /**
   * POST /api/auth/logout
   */
  public static async logout(req: Request, res: Response<ApiResponse>): Promise<void> {
    // If cookies were used, clear cookie here:
    // res.clearCookie('token', { ... });
    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  }
}
