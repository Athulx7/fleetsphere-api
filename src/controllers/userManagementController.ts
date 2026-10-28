import type { Request, Response } from 'express';
import type { ApiResponse } from '../types/auth.js';

export class UserManagementController {
  /**
   * GET /api/user-management
   * List users with multi-column filtering and joins
   */
  public static async getUsers(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const {
        search,
        user_code,
        emp_code,
        user_name,
        designation_id,
        region_id,
        branch_id,
        status,
      } = req.query;

      let whereConditions = [`1=1`];
      const params: any[] = [];

      if (search && String(search).trim()) {
        params.push(`%${String(search).trim()}%`);
        const idx = params.length;
        whereConditions.push(`(
          p.user_code ILIKE $${idx} OR
          p.user_name ILIKE $${idx} OR
          p.email ILIKE $${idx} OR
          e.employee_code ILIKE $${idx}
        )`);
      }

      if (user_code && String(user_code).trim()) {
        params.push(`%${String(user_code).trim()}%`);
        whereConditions.push(`p.user_code ILIKE $${params.length}`);
      }

      if (emp_code && String(emp_code).trim()) {
        params.push(`%${String(emp_code).trim()}%`);
        whereConditions.push(`e.employee_code ILIKE $${params.length}`);
      }

      if (user_name && String(user_name).trim()) {
        params.push(`%${String(user_name).trim()}%`);
        whereConditions.push(`p.user_name ILIKE $${params.length}`);
      }

      if (designation_id && String(designation_id).trim()) {
        params.push(Number(designation_id));
        whereConditions.push(`e.designation_id = $${params.length}`);
      }

      if (region_id && String(region_id).trim()) {
        params.push(Number(region_id));
        whereConditions.push(`p.region_id = $${params.length}`);
      }

      if (branch_id && String(branch_id).trim()) {
        params.push(Number(branch_id));
        whereConditions.push(`p.branch_id = $${params.length}`);
      }

      if (status && String(status).trim() && String(status).toUpperCase() !== 'ALL') {
        params.push(String(status).trim().toUpperCase());
        whereConditions.push(`p.user_status = $${params.length}`);
      }

      const sql = `
        SELECT 
          p.id,
          p.user_code,
          p.employee_id,
          e.employee_code,
          p.user_name,
          p.email,
          p.phone_number,
          e.designation_id,
          d.designation_name,
          dept.dept_name,
          p.reporting_manager_id,
          mgr.user_name AS manager_name,
          mgr.user_code AS manager_code,
          p.region_id,
          r.region_name,
          p.area_id,
          a.area_name,
          p.branch_id,
          b.branch_name,
          p.shift_id,
          s.shift_name,
          p.role_code,
          p.user_status,
          p.close_reason,
          p.closed_at,
          p.reopened_at,
          p.notes,
          p.created_at,
          p.updated_at
        FROM public.tbl_user_profile_mst p
        INNER JOIN public.tbl_employee_master e ON p.employee_id = e.id
        LEFT JOIN public.tbl_designation_master d ON e.designation_id = d.id
        LEFT JOIN public.tbl_department_mst dept ON e.department_id = dept.id
        LEFT JOIN public.tbl_user_profile_mst mgr ON p.reporting_manager_id = mgr.id
        LEFT JOIN public.tbl_region_mst r ON p.region_id = r.id
        LEFT JOIN public.tbl_area_mst a ON p.area_id = a.id
        LEFT JOIN public.tbl_branch_mst b ON p.branch_id = b.id
        LEFT JOIN public.tbl_shift_mst s ON p.shift_id = s.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY p.id DESC;
      `;

      const result = await pool.query(sql, params);

      res.status(200).json({
        success: true,
        data: result.rows,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * GET /api/user-management/stats
   */
  public static async getStats(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const countsRes = await pool.query(`
        SELECT 
          COUNT(*)::int AS total_users,
          COUNT(*) FILTER (WHERE user_status = 'ACTIVE')::int AS active_users,
          COUNT(*) FILTER (WHERE user_status = 'CLOSED')::int AS closed_users,
          COUNT(DISTINCT reporting_manager_id) FILTER (WHERE reporting_manager_id IS NOT NULL)::int AS reporting_managers
        FROM public.tbl_user_profile_mst;
      `);

      res.status(200).json({
        success: true,
        data: countsRes.rows[0] || { total_users: 0, active_users: 0, closed_users: 0, reporting_managers: 0 },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * GET /api/user-management/config
   * Fetches the multi-tenant control rules
   */
  public static async getConfig(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const resData = await pool.query(`
        SELECT * FROM public.tbl_user_control_mst 
        WHERE is_active = TRUE 
        ORDER BY id ASC LIMIT 1;
      `);

      if (resData.rows.length === 0) {
        // Return fallback defaults
        res.status(200).json({
          success: true,
          data: {
            is_auto_user_code: true,
            user_code_prefix: 'USR',
            user_code_length: 4,
            allow_manual_code_override: true,
            allow_closed_code_reuse: true,
            require_employee_validation: true,
            auto_fetch_employee_name: true,
            require_reporting_manager: false,
            require_region_assignment: false,
            default_role_code: 'OPERATOR',
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: resData.rows[0],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * PUT /api/user-management/config
   * Updates tenant user provisioning configuration
   */
  public static async updateConfig(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const {
        is_auto_user_code,
        user_code_prefix,
        user_code_length,
        allow_manual_code_override,
        allow_closed_code_reuse,
        require_employee_validation,
        auto_fetch_employee_name,
        require_reporting_manager,
        require_region_assignment,
        default_role_code,
        description,
      } = req.body;

      const updateRes = await pool.query(`
        UPDATE public.tbl_user_control_mst
        SET 
          is_auto_user_code = COALESCE($1, is_auto_user_code),
          user_code_prefix = COALESCE($2, user_code_prefix),
          user_code_length = COALESCE($3, user_code_length),
          allow_manual_code_override = COALESCE($4, allow_manual_code_override),
          allow_closed_code_reuse = COALESCE($5, allow_closed_code_reuse),
          require_employee_validation = COALESCE($6, require_employee_validation),
          auto_fetch_employee_name = COALESCE($7, auto_fetch_employee_name),
          require_reporting_manager = COALESCE($8, require_reporting_manager),
          require_region_assignment = COALESCE($9, require_region_assignment),
          default_role_code = COALESCE($10, default_role_code),
          description = COALESCE($11, description),
          updated_at = NOW()
        WHERE id = (SELECT id FROM public.tbl_user_control_mst ORDER BY id ASC LIMIT 1)
        RETURNING *;
      `, [
        is_auto_user_code,
        user_code_prefix,
        user_code_length,
        allow_manual_code_override,
        allow_closed_code_reuse,
        require_employee_validation,
        auto_fetch_employee_name,
        require_reporting_manager,
        require_region_assignment,
        default_role_code,
        description,
      ]);

      res.status(200).json({
        success: true,
        message: 'Tenant user management control configuration updated successfully.',
        data: updateRes.rows[0],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * GET /api/user-management/validate-employee/:empCode
   * Validates that employee is genuine and returns auto-fill info
   */
  public static async validateEmployee(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const empCode = String(req.params['empCode'] || '').trim();

      if (!empCode) {
        res.status(400).json({ success: false, message: 'Employee code is required' });
        return;
      }

      // Check employee record
      const empRes = await pool.query(`
        SELECT 
          e.id,
          e.employee_code,
          e.first_name,
          e.last_name,
          e.email,
          e.phone_number,
          e.joining_date,
          e.designation_id,
          d.designation_name,
          e.department_id,
          dept.dept_name,
          e.branch_id,
          b.branch_name,
          e.region_id,
          r.region_name,
          e.area_id,
          a.area_name,
          e.shift_id,
          s.shift_name,
          e.is_active
        FROM public.tbl_employee_master e
        LEFT JOIN public.tbl_designation_master d ON e.designation_id = d.id
        LEFT JOIN public.tbl_department_mst dept ON e.department_id = dept.id
        LEFT JOIN public.tbl_branch_mst b ON e.branch_id = b.id
        LEFT JOIN public.tbl_region_mst r ON e.region_id = r.id
        LEFT JOIN public.tbl_area_mst a ON e.area_id = a.id
        LEFT JOIN public.tbl_shift_mst s ON e.shift_id = s.id
        WHERE LOWER(e.employee_code) = LOWER($1);
      `, [empCode]);

      if (empRes.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: `Employee "${empCode}" not found in Employee Master.`,
        });
        return;
      }

      const emp = empRes.rows[0];

      // Check if employee already has an active user account
      const existingUser = await pool.query(`
        SELECT id, user_code, user_status 
        FROM public.tbl_user_profile_mst 
        WHERE employee_id = $1 AND user_status = 'ACTIVE';
      `, [emp.id]);

      if (existingUser.rows.length > 0) {
        res.status(400).json({
          success: false,
          message: `Employee "${empCode}" is genuine, but already has an ACTIVE user account (${existingUser.rows[0].user_code}).`,
          data: {
            is_genuine: true,
            has_active_user: true,
            existing_user: existingUser.rows[0],
            employee: emp,
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Employee validated successfully as genuine.',
        data: {
          is_genuine: true,
          has_active_user: false,
          employee: {
            ...emp,
            full_name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
          },
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * GET /api/user-management/next-code
   * Generates next user code based on multi-tenant control settings
   */
  public static async getNextCode(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;

      // Get tenant config
      const cfgRes = await pool.query(`
        SELECT is_auto_user_code, user_code_prefix, user_code_length, allow_closed_code_reuse
        FROM public.tbl_user_control_mst 
        LIMIT 1;
      `);

      const cfg = cfgRes.rows[0] || {
        is_auto_user_code: true,
        user_code_prefix: 'USR',
        user_code_length: 4,
        allow_closed_code_reuse: true,
      };

      if (!cfg.is_auto_user_code) {
        res.status(200).json({
          success: true,
          data: { code: '', is_auto: false },
        });
        return;
      }

      const prefix = cfg.user_code_prefix || 'USR';
      const len = cfg.user_code_length || 4;

      // If allow_closed_code_reuse is true, check if any closed user code can be recycled
      if (cfg.allow_closed_code_reuse) {
        const closedCodesRes = await pool.query(`
          SELECT user_code 
          FROM public.tbl_user_profile_mst 
          WHERE user_status = 'CLOSED' 
            AND user_code ILIKE $1
            AND user_code NOT IN (SELECT user_code FROM public.tbl_user_profile_mst WHERE user_status = 'ACTIVE')
          ORDER BY id ASC 
          LIMIT 1;
        `, [`${prefix}%`]);

        if (closedCodesRes.rows.length > 0) {
          res.status(200).json({
            success: true,
            data: {
              code: closedCodesRes.rows[0].user_code,
              is_auto: true,
              is_reused: true,
              note: 'Reusing previously closed user code as allowed by tenant policy',
            },
          });
          return;
        }
      }

      // Generate sequence code
      const query = `
        SELECT user_code 
        FROM public.tbl_user_profile_mst 
        WHERE user_code ILIKE $1;
      `;
      const resCodes = await pool.query(query, [`${prefix}%`]);

      let maxSeq = 0;
      const regex = new RegExp(`^${prefix}(\\d+)$`, 'i');

      resCodes.rows.forEach((r: { user_code: string }) => {
        const match = r.user_code.match(regex);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (num > maxSeq) maxSeq = num;
        }
      });

      const nextNum = maxSeq + 1;
      const nextCode = `${prefix}${String(nextNum).padStart(len, '0')}`;

      res.status(200).json({
        success: true,
        data: {
          code: nextCode,
          is_auto: true,
          is_reused: false,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * GET /api/user-management/dropdowns
   * Lookups for dropdowns: managers, regions, areas, branches, shifts, roles
   */
  public static async getDropdowns(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;

      // Active users that can act as reporting managers
      const mgrsRes = await pool.query(`
        SELECT id, user_code, user_name, role_code 
        FROM public.tbl_user_profile_mst 
        WHERE user_status = 'ACTIVE' 
        ORDER BY user_name ASC;
      `);

      // Regions
      const regRes = await pool.query(`SELECT id, region_name FROM public.tbl_region_mst WHERE is_active = TRUE ORDER BY region_name ASC;`);

      // Areas (with region_id for cascading)
      const areaRes = await pool.query(`SELECT id, area_name, region_id FROM public.tbl_area_mst WHERE is_active = TRUE ORDER BY area_name ASC;`);

      // Branches
      const branchRes = await pool.query(`SELECT id, branch_name, branch_type FROM public.tbl_branch_mst WHERE is_active = TRUE ORDER BY branch_name ASC;`);

      // Shifts
      const shiftRes = await pool.query(`SELECT id, shift_name, start_time, end_time FROM public.tbl_shift_mst WHERE is_active = TRUE ORDER BY shift_name ASC;`);

      // Designations
      const desigRes = await pool.query(`SELECT id, designation_name FROM public.tbl_designation_master WHERE is_active = TRUE ORDER BY designation_name ASC;`);

      // Roles
      const rolesRes = await pool.query(`SELECT c_role_code, c_role_name FROM public.tbl_role_mst WHERE b_is_active = TRUE ORDER BY c_role_name ASC;`);

      res.status(200).json({
        success: true,
        data: {
          managers: mgrsRes.rows,
          regions: regRes.rows,
          areas: areaRes.rows,
          branches: branchRes.rows,
          shifts: shiftRes.rows,
          designations: desigRes.rows,
          roles: rolesRes.rows.length > 0 ? rolesRes.rows : [
            { c_role_code: 'ADMIN', c_role_name: 'Administrator' },
            { c_role_code: 'FLEET_MANAGER', c_role_name: 'Fleet Manager' },
            { c_role_code: 'SUPERVISOR', c_role_name: 'Operations Supervisor' },
            { c_role_code: 'DISPATCHER', c_role_name: 'Dispatcher' },
            { c_role_code: 'DRIVER', c_role_name: 'Commercial Driver' },
            { c_role_code: 'OPERATOR', c_role_name: 'Standard Operator' },
          ],
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * GET /api/user-management/:id
   */
  public static async getUserById(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const id = req.params['id'];

      const sql = `
        SELECT 
          p.*,
          e.employee_code,
          d.designation_name,
          dept.dept_name,
          mgr.user_name AS manager_name,
          mgr.user_code AS manager_code,
          r.region_name,
          a.area_name,
          b.branch_name,
          s.shift_name
        FROM public.tbl_user_profile_mst p
        INNER JOIN public.tbl_employee_master e ON p.employee_id = e.id
        LEFT JOIN public.tbl_designation_master d ON e.designation_id = d.id
        LEFT JOIN public.tbl_department_mst dept ON e.department_id = dept.id
        LEFT JOIN public.tbl_user_profile_mst mgr ON p.reporting_manager_id = mgr.id
        LEFT JOIN public.tbl_region_mst r ON p.region_id = r.id
        LEFT JOIN public.tbl_area_mst a ON p.area_id = a.id
        LEFT JOIN public.tbl_branch_mst b ON p.branch_id = b.id
        LEFT JOIN public.tbl_shift_mst s ON p.shift_id = s.id
        WHERE p.id = $1
        LIMIT 1;
      `;

      const resRow = await pool.query(sql, [id]);

      if (resRow.rows.length === 0) {
        res.status(404).json({ success: false, message: 'User profile not found' });
        return;
      }

      res.status(200).json({
        success: true,
        data: resRow.rows[0],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * POST /api/user-management
   * Provision new user
   */
  public static async createUser(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const {
        employee_id,
        user_code,
        user_name,
        email,
        phone_number,
        reporting_manager_id,
        region_id,
        area_id,
        branch_id,
        shift_id,
        role_code,
        notes,
      } = req.body;

      if (!employee_id) {
        res.status(400).json({ success: false, message: 'Employee reference is required.' });
        return;
      }

      if (!user_code || !String(user_code).trim()) {
        res.status(400).json({ success: false, message: 'User code is required.' });
        return;
      }

      // Check if employee already has active user
      const empCheck = await pool.query(
        `SELECT id, user_code FROM public.tbl_user_profile_mst WHERE employee_id = $1 AND user_status = 'ACTIVE';`,
        [employee_id]
      );
      if (empCheck.rows.length > 0) {
        res.status(400).json({
          success: false,
          message: `This employee already has an active user account (${empCheck.rows[0].user_code}).`,
        });
        return;
      }

      // Check if user_code is already occupied by an ACTIVE user
      const codeCheck = await pool.query(
        `SELECT id FROM public.tbl_user_profile_mst WHERE LOWER(user_code) = LOWER($1) AND user_status = 'ACTIVE';`,
        [String(user_code).trim()]
      );
      if (codeCheck.rows.length > 0) {
        res.status(400).json({
          success: false,
          message: `User code "${user_code}" is currently in use by an active user. Please choose a unique user code.`,
        });
        return;
      }

      // Insert User Profile
      const insertSql = `
        INSERT INTO public.tbl_user_profile_mst (
          user_code,
          employee_id,
          user_name,
          email,
          phone_number,
          reporting_manager_id,
          region_id,
          area_id,
          branch_id,
          shift_id,
          role_code,
          user_status,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'ACTIVE', $12)
        RETURNING *;
      `;

      const insertRes = await pool.query(insertSql, [
        String(user_code).trim().toUpperCase(),
        employee_id,
        user_name ? String(user_name).trim() : 'System User',
        email ? String(email).trim() : '',
        phone_number || null,
        reporting_manager_id || null,
        region_id || null,
        area_id || null,
        branch_id || null,
        shift_id || null,
        role_code || 'OPERATOR',
        notes || null,
      ]);

      res.status(201).json({
        success: true,
        message: `User "${user_code}" provisioned successfully.`,
        data: insertRes.rows[0],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * PUT /api/user-management/:id
   */
  public static async updateUser(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const id = req.params['id'];
      const {
        user_name,
        email,
        phone_number,
        reporting_manager_id,
        region_id,
        area_id,
        branch_id,
        shift_id,
        role_code,
        notes,
      } = req.body;

      const updateSql = `
        UPDATE public.tbl_user_profile_mst
        SET
          user_name = COALESCE($1, user_name),
          email = COALESCE($2, email),
          phone_number = COALESCE($3, phone_number),
          reporting_manager_id = $4,
          region_id = $5,
          area_id = $6,
          branch_id = $7,
          shift_id = $8,
          role_code = COALESCE($9, role_code),
          notes = COALESCE($10, notes),
          updated_at = NOW()
        WHERE id = $11
        RETURNING *;
      `;

      const updateRes = await pool.query(updateSql, [
        user_name,
        email,
        phone_number,
        reporting_manager_id || null,
        region_id || null,
        area_id || null,
        branch_id || null,
        shift_id || null,
        role_code,
        notes,
        id,
      ]);

      if (updateRes.rows.length === 0) {
        res.status(404).json({ success: false, message: 'User profile not found.' });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'User profile updated successfully.',
        data: updateRes.rows[0],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * POST /api/user-management/:id/close
   * Closes a user account with a reason (freeing user_code if reuse is enabled)
   */
  public static async closeUser(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const id = req.params['id'];
      const { close_reason } = req.body;

      const userRes = await pool.query(`SELECT id, user_code, user_status FROM public.tbl_user_profile_mst WHERE id = $1;`, [id]);
      if (userRes.rows.length === 0) {
        res.status(404).json({ success: false, message: 'User not found.' });
        return;
      }

      if (userRes.rows[0].user_status === 'CLOSED') {
        res.status(400).json({ success: false, message: 'User is already closed.' });
        return;
      }

      const closeRes = await pool.query(`
        UPDATE public.tbl_user_profile_mst
        SET 
          user_status = 'CLOSED',
          close_reason = $1,
          closed_at = NOW(),
          closed_by = 'ADMIN',
          updated_at = NOW()
        WHERE id = $2
        RETURNING *;
      `, [close_reason || 'Administrative closure', id]);

      res.status(200).json({
        success: true,
        message: `User account "${closeRes.rows[0].user_code}" has been closed.`,
        data: closeRes.rows[0],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * POST /api/user-management/:id/reopen
   * Re-opens a closed user account
   */
  public static async reopenUser(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const id = req.params['id'];

      const userRes = await pool.query(`
        SELECT id, user_code, employee_id, user_status 
        FROM public.tbl_user_profile_mst 
        WHERE id = $1;
      `, [id]);

      if (userRes.rows.length === 0) {
        res.status(404).json({ success: false, message: 'User not found.' });
        return;
      }

      const user = userRes.rows[0];

      if (user.user_status === 'ACTIVE') {
        res.status(400).json({ success: false, message: 'User is already active.' });
        return;
      }

      // Check if user_code has been reassigned to another active user
      const codeCheck = await pool.query(`
        SELECT id, user_code FROM public.tbl_user_profile_mst 
        WHERE LOWER(user_code) = LOWER($1) AND user_status = 'ACTIVE' AND id != $2;
      `, [user.user_code, id]);

      if (codeCheck.rows.length > 0) {
        res.status(400).json({
          success: false,
          message: `Cannot reopen: User code "${user.user_code}" has since been reassigned to another active user.`,
        });
        return;
      }

      // Check if employee already has another active user
      const empCheck = await pool.query(`
        SELECT id, user_code FROM public.tbl_user_profile_mst 
        WHERE employee_id = $1 AND user_status = 'ACTIVE' AND id != $2;
      `, [user.employee_id, id]);

      if (empCheck.rows.length > 0) {
        res.status(400).json({
          success: false,
          message: `Cannot reopen: The associated employee already has another active user (${empCheck.rows[0].user_code}).`,
        });
        return;
      }

      const reopenRes = await pool.query(`
        UPDATE public.tbl_user_profile_mst
        SET 
          user_status = 'ACTIVE',
          reopened_at = NOW(),
          reopened_by = 'ADMIN',
          close_reason = NULL,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *;
      `, [id]);

      res.status(200).json({
        success: true,
        message: `User account "${user.user_code}" has been re-opened successfully.`,
        data: reopenRes.rows[0],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * DELETE /api/user-management/:id
   */
  public static async deleteUser(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const id = req.params['id'];

      const delRes = await pool.query(`DELETE FROM public.tbl_user_profile_mst WHERE id = $1 RETURNING user_code;`, [id]);
      if (delRes.rows.length === 0) {
        res.status(404).json({ success: false, message: 'User not found.' });
        return;
      }

      res.status(200).json({
        success: true,
        message: `User "${delRes.rows[0].user_code}" deleted successfully.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }
}
