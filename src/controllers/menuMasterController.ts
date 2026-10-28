import type { Request, Response } from 'express';
import type { ApiResponse } from '../types/auth.js';

export class MenuMasterController {
  /**
   * GET /api/menus/user-menu
   * Retrieves the dynamic hierarchical menu tree for the currently logged in user
   */
  public static async getUserMenuTree(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const userRoles = req.tenantContext?.user?.roles || ['ADMIN'];
      const employeeId = req.tenantContext?.user?.employeeId || null;

      // Query sub-menus accessible via roles or direct employee grants
      const query = `
        SELECT DISTINCT
          h.header_id,
          h.header_name,
          h.header_code,
          h.icon_name AS header_icon,
          h.display_order AS header_display_order,
          sm.sub_menu_id,
          sm.sub_menu_name,
          sm.route_path,
          sm.icon_name AS sub_icon,
          sm.display_order AS sub_display_order,
          COALESCE(sm.is_sidebar_visible, TRUE) AS is_sidebar_visible,
          COALESCE(sm.description, '') AS description
        FROM public.tbl_sub_menu_mst sm
        INNER JOIN public.tbl_menu_mst_header h ON sm.header_id = h.header_id
        LEFT JOIN public.tbl_role_menu_mapping rmm 
          ON sm.sub_menu_id = rmm.sub_menu_id 
          AND rmm.role_code = ANY($1::text[]) 
          AND rmm.can_view = TRUE 
          AND rmm.is_active = TRUE
        LEFT JOIN public.tbl_employee_menu_mapping emm 
          ON sm.sub_menu_id = emm.sub_menu_id 
          AND emm.employee_id = $2 
          AND emm.is_active = TRUE
        WHERE sm.is_active = TRUE 
          AND h.is_active = TRUE
          AND (rmm.mapping_id IS NOT NULL OR emm.is_granted = TRUE)
        ORDER BY h.display_order ASC, sm.display_order ASC;
      `;

      const menuRes = await pool.query(query, [userRoles, employeeId]);

      // Group menus by Header Name
      const groupedMenus: Record<string, any[]> = {};
      const headerList: any[] = [];
      const seenHeaders = new Set<string>();

      for (const row of menuRes.rows) {
        if (!groupedMenus[row.header_name]) {
          groupedMenus[row.header_name] = [];
        }

        if (!seenHeaders.has(row.header_name)) {
          seenHeaders.add(row.header_name);
          headerList.push({
            header_id: row.header_id,
            header_name: row.header_name,
            header_code: row.header_code,
            icon_name: row.header_icon,
            display_order: row.header_display_order,
          });
        }

        groupedMenus[row.header_name].push({
          sub_menu_id: row.sub_menu_id,
          sub_menu_name: row.sub_menu_name,
          route_path: row.route_path,
          sub_icon: row.sub_icon,
          icon_name: row.sub_icon,
          display_order: row.sub_display_order,
          is_sidebar_visible: row.is_sidebar_visible !== false,
          description: row.description || '',
        });
      }

      res.status(200).json({
        success: true,
        data: {
          groupedMenus,
          headers: headerList,
          rawList: menuRes.rows,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * GET /api/mainMenu or /api/menus/main-menu
   * Retrieves all modules and pages formatted specifically for the MainMenu overlay grid
   */
  public static async getMainMenu(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const userRoles = req.tenantContext?.user?.roles || ['ADMIN'];
      const employeeId = req.tenantContext?.user?.employeeId || null;

      const query = `
        SELECT DISTINCT
          h.header_id,
          h.header_name,
          h.header_code,
          h.icon_name AS header_icon,
          h.display_order AS header_display_order,
          sm.sub_menu_id,
          sm.sub_menu_name,
          sm.route_path,
          sm.icon_name AS sub_icon,
          sm.display_order AS sub_display_order,
          COALESCE(sm.is_sidebar_visible, TRUE) AS is_sidebar_visible,
          COALESCE(sm.description, '') AS description
        FROM public.tbl_sub_menu_mst sm
        INNER JOIN public.tbl_menu_mst_header h ON sm.header_id = h.header_id
        LEFT JOIN public.tbl_role_menu_mapping rmm 
          ON sm.sub_menu_id = rmm.sub_menu_id 
          AND rmm.role_code = ANY($1::text[]) 
          AND rmm.can_view = TRUE 
          AND rmm.is_active = TRUE
        LEFT JOIN public.tbl_employee_menu_mapping emm 
          ON sm.sub_menu_id = emm.sub_menu_id 
          AND emm.employee_id = $2 
          AND emm.is_active = TRUE
        WHERE sm.is_active = TRUE 
          AND h.is_active = TRUE
          AND (rmm.mapping_id IS NOT NULL OR emm.is_granted = TRUE)
        ORDER BY h.display_order ASC, sm.display_order ASC;
      `;

      const menuRes = await pool.query(query, [userRoles, employeeId]);

      // Group menus by Category into array: [ { category, icon, items: [...] } ]
      const categoryMap = new Map<string, { category: string; icon: string; items: any[] }>();

      for (const row of menuRes.rows) {
        if (!categoryMap.has(row.header_name)) {
          categoryMap.set(row.header_name, {
            category: row.header_name,
            icon: row.header_icon || 'LayoutDashboard',
            items: [],
          });
        }

        categoryMap.get(row.header_name)!.items.push({
          sub_menu_id: row.sub_menu_id,
          label: row.sub_menu_name,
          sub_menu_name: row.sub_menu_name,
          routes: row.route_path,
          route_path: row.route_path,
          description: row.description || `Manage ${row.sub_menu_name.toLowerCase()} and related operations`,
          icon: row.sub_icon || 'Layers',
          display_order: row.sub_display_order,
          is_sidebar_visible: row.is_sidebar_visible !== false,
        });
      }

      res.status(200).json({
        success: true,
        data: Array.from(categoryMap.values()),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * GET /api/menus/headers
   */
  public static async getHeaders(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const resData = await pool.query(`
        SELECT 
          h.*,
          COUNT(sm.sub_menu_id)::int AS sub_menu_count
        FROM public.tbl_menu_mst_header h
        LEFT JOIN public.tbl_sub_menu_mst sm ON h.header_id = sm.header_id
        GROUP BY h.header_id
        ORDER BY h.display_order ASC;
      `);

      res.status(200).json({
        success: true,
        data: resData.rows,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * POST /api/menus/headers
   */
  public static async createHeader(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const { header_name, header_code, icon_name, display_order, is_active } = req.body;

      if (!header_name || !String(header_name).trim()) {
        res.status(400).json({ success: false, message: 'Header name is required.' });
        return;
      }

      const insertRes = await pool.query(
        `INSERT INTO public.tbl_menu_mst_header 
         (header_name, header_code, icon_name, display_order, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *;`,
        [
          header_name.trim(),
          header_code ? header_code.trim().toLowerCase() : header_name.trim().toLowerCase().replace(/\s+/g, '_'),
          icon_name || 'LayoutDashboard',
          Number(display_order) || 1,
          is_active !== undefined ? Boolean(is_active) : true,
        ]
      );

      res.status(201).json({
        success: true,
        message: 'Menu header created successfully.',
        data: insertRes.rows[0],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * PUT /api/menus/headers/:headerId
   */
  public static async updateHeader(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const headerId = req.params.headerId;
      const { header_name, header_code, icon_name, display_order, is_active } = req.body;

      const updateRes = await pool.query(
        `UPDATE public.tbl_menu_mst_header
         SET header_name = COALESCE($1, header_name),
             header_code = COALESCE($2, header_code),
             icon_name = COALESCE($3, icon_name),
             display_order = COALESCE($4, display_order),
             is_active = COALESCE($5, is_active),
             updated_at = NOW()
         WHERE header_id = $6
         RETURNING *;`,
        [
          header_name ? header_name.trim() : null,
          header_code ? header_code.trim() : null,
          icon_name,
          display_order !== undefined ? Number(display_order) : null,
          is_active !== undefined ? Boolean(is_active) : null,
          headerId,
        ]
      );

      if (updateRes.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Header not found.' });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Menu header updated successfully.',
        data: updateRes.rows[0],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * DELETE /api/menus/headers/:headerId
   */
  public static async deleteHeader(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const headerId = req.params.headerId;

      await pool.query(`DELETE FROM public.tbl_menu_mst_header WHERE header_id = $1;`, [headerId]);

      res.status(200).json({
        success: true,
        message: 'Menu header deleted successfully.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * GET /api/menus/sub-menus
   */
  public static async getSubMenus(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const resData = await pool.query(`
        SELECT 
          sm.*,
          h.header_name,
          h.header_code
        FROM public.tbl_sub_menu_mst sm
        INNER JOIN public.tbl_menu_mst_header h ON sm.header_id = h.header_id
        ORDER BY h.display_order ASC, sm.display_order ASC;
      `);

      res.status(200).json({
        success: true,
        data: resData.rows,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * POST /api/menus/sub-menus
   */
  public static async createSubMenu(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const {
        header_id,
        sub_menu_name,
        route_path,
        icon_name,
        display_order,
        is_sidebar_visible,
        description,
        is_active,
      } = req.body;

      if (!header_id || !sub_menu_name || !route_path) {
        res.status(400).json({
          success: false,
          message: 'Header, sub-menu name, and route path are required.',
        });
        return;
      }

      const insertRes = await pool.query(
        `INSERT INTO public.tbl_sub_menu_mst
         (header_id, sub_menu_name, route_path, icon_name, display_order, is_sidebar_visible, description, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *;`,
        [
          Number(header_id),
          sub_menu_name.trim(),
          route_path.trim(),
          icon_name || 'Layers',
          Number(display_order) || 1,
          is_sidebar_visible !== undefined ? Boolean(is_sidebar_visible) : true,
          description ? description.trim() : null,
          is_active !== undefined ? Boolean(is_active) : true,
        ]
      );

      // Automatically map new sub-menu to ADMIN role
      await pool.query(
        `INSERT INTO public.tbl_role_menu_mapping (role_code, sub_menu_id, can_view, can_add, can_edit, can_delete, is_active)
         VALUES ('ADMIN', $1, TRUE, TRUE, TRUE, TRUE, TRUE)
         ON CONFLICT (role_code, sub_menu_id) DO NOTHING;`,
        [insertRes.rows[0].sub_menu_id]
      );

      res.status(201).json({
        success: true,
        message: 'Sub-menu created successfully.',
        data: insertRes.rows[0],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * PUT /api/menus/sub-menus/:subMenuId
   */
  public static async updateSubMenu(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const subMenuId = req.params.subMenuId;
      const {
        header_id,
        sub_menu_name,
        route_path,
        icon_name,
        display_order,
        is_sidebar_visible,
        description,
        is_active,
      } = req.body;

      const updateRes = await pool.query(
        `UPDATE public.tbl_sub_menu_mst
         SET header_id = COALESCE($1, header_id),
             sub_menu_name = COALESCE($2, sub_menu_name),
             route_path = COALESCE($3, route_path),
             icon_name = COALESCE($4, icon_name),
             display_order = COALESCE($5, display_order),
             is_sidebar_visible = COALESCE($6, is_sidebar_visible),
             description = COALESCE($7, description),
             is_active = COALESCE($8, is_active),
             updated_at = NOW()
         WHERE sub_menu_id = $9
         RETURNING *;`,
        [
          header_id !== undefined ? Number(header_id) : null,
          sub_menu_name ? sub_menu_name.trim() : null,
          route_path ? route_path.trim() : null,
          icon_name,
          display_order !== undefined ? Number(display_order) : null,
          is_sidebar_visible !== undefined ? Boolean(is_sidebar_visible) : null,
          description !== undefined ? description : null,
          is_active !== undefined ? Boolean(is_active) : null,
          subMenuId,
        ]
      );

      if (updateRes.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Sub-menu not found.' });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Sub-menu updated successfully.',
        data: updateRes.rows[0],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * PUT /api/menus/sub-menus-batch
   * Batch updates display_order and is_sidebar_visible for multiple sub-menus
   */
  public static async updateSubMenuBatch(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const { items } = req.body;

      if (!Array.isArray(items)) {
        res.status(400).json({ success: false, message: 'items array is required.' });
        return;
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const item of items) {
          const { sub_menu_id, display_order, is_sidebar_visible } = item;
          await client.query(
            `UPDATE public.tbl_sub_menu_mst
             SET display_order = COALESCE($1, display_order),
                 is_sidebar_visible = COALESCE($2, is_sidebar_visible),
                 updated_at = NOW()
             WHERE sub_menu_id = $3;`,
            [
              display_order !== undefined ? Number(display_order) : null,
              is_sidebar_visible !== undefined ? Boolean(is_sidebar_visible) : null,
              Number(sub_menu_id),
            ]
          );
        }
        await client.query('COMMIT');

        res.status(200).json({
          success: true,
          message: 'Sub-menus display order and sidebar visibility updated successfully.',
        });
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * DELETE /api/menus/sub-menus/:subMenuId
   */
  public static async deleteSubMenu(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const subMenuId = req.params.subMenuId;

      await pool.query(`DELETE FROM public.tbl_sub_menu_mst WHERE sub_menu_id = $1;`, [subMenuId]);

      res.status(200).json({
        success: true,
        message: 'Sub-menu deleted successfully.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * GET /api/menus/roles
   */
  public static async getRoles(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const roleRes = await pool.query(
        `SELECT u_role_id AS role_id, c_role_code AS role_code, c_role_name AS role_name, c_description
         FROM public.tbl_role_mst 
         WHERE b_is_active = TRUE
         ORDER BY c_role_name ASC;`
      );

      res.status(200).json({
        success: true,
        data: roleRes.rows,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * GET /api/menus/employees
   */
  public static async getEmployees(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const empRes = await pool.query(
        `SELECT 
          u_employee_id AS employee_id,
          c_employee_code AS employee_code,
          c_first_name AS first_name,
          c_last_name AS last_name,
          c_email AS email
         FROM public.tbl_employee_mst 
         WHERE b_is_active = TRUE
         ORDER BY c_first_name ASC;`
      );

      res.status(200).json({
        success: true,
        data: empRes.rows,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * GET /api/menus/designations
   */
  public static async getDesignations(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const desigRes = await pool.query(
        `SELECT 
          u_designation_id AS designation_id,
          c_designation_code AS designation_code,
          c_designation_name AS designation_name
         FROM public.tbl_designation_mst 
         WHERE b_is_active = TRUE
         ORDER BY c_designation_name ASC;`
      );

      res.status(200).json({
        success: true,
        data: desigRes.rows,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * GET /api/menus/mappings/role/:roleCode
   * Returns complete menu tree annotated with current role mapping status
   */
  public static async getRoleMappings(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const roleCode = String(req.params.roleCode || 'ADMIN').toUpperCase();

      const query = `
        SELECT 
          h.header_id,
          h.header_name,
          h.display_order AS header_order,
          sm.sub_menu_id,
          sm.sub_menu_name,
          sm.route_path,
          sm.icon_name,
          sm.display_order AS sub_order,
          COALESCE(rmm.is_active, FALSE) AS is_mapped,
          COALESCE(rmm.can_view, FALSE) AS can_view,
          COALESCE(rmm.can_add, FALSE) AS can_add,
          COALESCE(rmm.can_edit, FALSE) AS can_edit,
          COALESCE(rmm.can_delete, FALSE) AS can_delete
        FROM public.tbl_menu_mst_header h
        INNER JOIN public.tbl_sub_menu_mst sm ON h.header_id = sm.header_id
        LEFT JOIN public.tbl_role_menu_mapping rmm 
          ON sm.sub_menu_id = rmm.sub_menu_id 
          AND rmm.role_code = $1
        WHERE h.is_active = TRUE AND sm.is_active = TRUE
        ORDER BY h.display_order ASC, sm.display_order ASC;
      `;

      const resData = await pool.query(query, [roleCode]);

      // Group by header for easy frontend consumption
      const grouped: Record<string, any[]> = {};
      for (const row of resData.rows) {
        if (!grouped[row.header_name]) {
          grouped[row.header_name] = [];
        }
        grouped[row.header_name].push(row);
      }

      res.status(200).json({
        success: true,
        data: {
          roleCode,
          grouped,
          allRows: resData.rows,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * POST /api/menus/mappings/role
   * Bulk updates multiple menu mappings for a role
   */
  public static async saveRoleMappings(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const { role_code, mappings } = req.body;

      if (!role_code || !Array.isArray(mappings)) {
        res.status(400).json({
          success: false,
          message: 'role_code and mappings array are required.',
        });
        return;
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        for (const item of mappings) {
          const { sub_menu_id, is_mapped, can_view, can_add, can_edit, can_delete } = item;
          const active = Boolean(is_mapped);

          await client.query(
            `INSERT INTO public.tbl_role_menu_mapping 
             (role_code, sub_menu_id, can_view, can_add, can_edit, can_delete, is_active, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
             ON CONFLICT (role_code, sub_menu_id) DO UPDATE
             SET can_view = EXCLUDED.can_view,
                 can_add = EXCLUDED.can_add,
                 can_edit = EXCLUDED.can_edit,
                 can_delete = EXCLUDED.can_delete,
                 is_active = EXCLUDED.is_active,
                 updated_at = NOW();`,
            [
              role_code.toUpperCase(),
              sub_menu_id,
              can_view !== undefined ? Boolean(can_view) : active,
              can_add !== undefined ? Boolean(can_add) : active,
              can_edit !== undefined ? Boolean(can_edit) : active,
              can_delete !== undefined ? Boolean(can_delete) : active,
              active,
            ]
          );
        }

        await client.query('COMMIT');
        res.status(200).json({
          success: true,
          message: `Role menu mappings for ${role_code} saved successfully.`,
        });
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * GET /api/menus/mappings/employee/:employeeId
   */
  public static async getEmployeeMappings(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const employeeId = req.params.employeeId;

      const query = `
        SELECT 
          h.header_id,
          h.header_name,
          h.display_order AS header_order,
          sm.sub_menu_id,
          sm.sub_menu_name,
          sm.route_path,
          sm.icon_name,
          sm.display_order AS sub_order,
          COALESCE(emm.is_granted, FALSE) AS is_granted,
          COALESCE(emm.can_view, TRUE) AS can_view,
          COALESCE(emm.can_add, TRUE) AS can_add,
          COALESCE(emm.can_edit, TRUE) AS can_edit,
          COALESCE(emm.can_delete, TRUE) AS can_delete
        FROM public.tbl_menu_mst_header h
        INNER JOIN public.tbl_sub_menu_mst sm ON h.header_id = sm.header_id
        LEFT JOIN public.tbl_employee_menu_mapping emm 
          ON sm.sub_menu_id = emm.sub_menu_id 
          AND emm.employee_id = $1 
          AND emm.is_active = TRUE
        WHERE h.is_active = TRUE AND sm.is_active = TRUE
        ORDER BY h.display_order ASC, sm.display_order ASC;
      `;

      const resData = await pool.query(query, [employeeId]);

      const grouped: Record<string, any[]> = {};
      for (const row of resData.rows) {
        if (!grouped[row.header_name]) {
          grouped[row.header_name] = [];
        }
        grouped[row.header_name].push(row);
      }

      res.status(200).json({
        success: true,
        data: {
          employeeId,
          grouped,
          allRows: resData.rows,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * POST /api/menus/mappings/employee
   * Bulk updates employee specific menu mappings
   */
  public static async saveEmployeeMappings(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const { employee_id, mappings } = req.body;

      if (!employee_id || !Array.isArray(mappings)) {
        res.status(400).json({
          success: false,
          message: 'employee_id and mappings array are required.',
        });
        return;
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        for (const item of mappings) {
          const { sub_menu_id, is_granted, can_view, can_add, can_edit, can_delete } = item;
          const granted = Boolean(is_granted);

          await client.query(
            `INSERT INTO public.tbl_employee_menu_mapping
             (employee_id, sub_menu_id, is_granted, can_view, can_add, can_edit, can_delete, is_active, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW())
             ON CONFLICT (employee_id, sub_menu_id) DO UPDATE
             SET is_granted = EXCLUDED.is_granted,
                 can_view = EXCLUDED.can_view,
                 can_add = EXCLUDED.can_add,
                 can_edit = EXCLUDED.can_edit,
                 can_delete = EXCLUDED.can_delete,
                 is_active = TRUE,
                 updated_at = NOW();`,
            [
              employee_id,
              sub_menu_id,
              granted,
              can_view !== undefined ? Boolean(can_view) : granted,
              can_add !== undefined ? Boolean(can_add) : granted,
              can_edit !== undefined ? Boolean(can_edit) : granted,
              can_delete !== undefined ? Boolean(can_delete) : granted,
            ]
          );
        }

        await client.query('COMMIT');
        res.status(200).json({
          success: true,
          message: 'Employee menu mappings saved successfully.',
        });
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }
}
