import type { Request, Response } from 'express';
import type { ApiResponse } from '../types/auth.js';

export class ControlPanelController {
  /**
   * GET /api/control-panel/modules
   * Returns list of configurable static modules
   */
  public static async getModules(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const sql = `
        SELECT 
          m.id,
          m.module_code,
          m.module_name,
          m.icon_name,
          m.category,
          m.description,
          m.display_order,
          m.is_active,
          COUNT(c.id)::int AS settings_count,
          MAX(c.updated_at) AS last_updated_at
        FROM public.tbl_control_module_mst m
        LEFT JOIN public.tbl_control_panel_config c ON m.module_code = c.module_code
        WHERE m.is_active = TRUE
        GROUP BY m.id
        ORDER BY m.display_order ASC;
      `;

      const result = await pool.query(sql);

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
   * GET /api/control-panel/modules/:moduleCode
   * Returns settings for a specific static module
   */
  public static async getModuleSettings(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const moduleCode = String(req.params['moduleCode'] || '').trim().toLowerCase();

      // Fetch module header
      const modRes = await pool.query(`
        SELECT * FROM public.tbl_control_module_mst 
        WHERE LOWER(module_code) = LOWER($1) AND is_active = TRUE 
        LIMIT 1;
      `, [moduleCode]);

      if (modRes.rows.length === 0) {
        res.status(404).json({ success: false, message: `Module "${moduleCode}" not found or inactive.` });
        return;
      }

      const moduleInfo = modRes.rows[0];

      // Fetch settings
      const settingsRes = await pool.query(`
        SELECT 
          id,
          module_code,
          setting_key,
          setting_label,
          setting_description,
          setting_type,
          setting_value,
          default_value,
          options_json,
          group_name,
          depends_on_key,
          display_order,
          is_active,
          updated_at
        FROM public.tbl_control_panel_config
        WHERE LOWER(module_code) = LOWER($1) AND is_active = TRUE
        ORDER BY group_name ASC, display_order ASC;
      `, [moduleCode]);

      // Organize settings by groups
      const groupsMap = new Map<string, any[]>();
      for (const s of settingsRes.rows) {
        const group = s.group_name || 'General Settings';
        if (!groupsMap.has(group)) {
          groupsMap.set(group, []);
        }
        groupsMap.get(group)!.push({
          ...s,
          parsed_value: s.setting_type === 'toggle' 
            ? s.setting_value === 'true' 
            : (s.setting_type === 'number' ? Number(s.setting_value) : s.setting_value),
        });
      }

      const groups = Array.from(groupsMap.entries()).map(([name, items]) => ({
        name,
        items,
      }));

      res.status(200).json({
        success: true,
        data: {
          module: moduleInfo,
          groups,
          settings: settingsRes.rows,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * PUT /api/control-panel/modules/:moduleCode
   * Saves updated settings into tbl_control_panel_config and syncs specialized tables
   */
  public static async updateModuleSettings(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const moduleCode = String(req.params['moduleCode'] || '').trim().toLowerCase();
      const { settings } = req.body;

      if (!settings || typeof settings !== 'object') {
        res.status(400).json({ success: false, message: 'Settings payload object is required.' });
        return;
      }

      // Update settings in tbl_control_panel_config
      for (const [key, val] of Object.entries(settings)) {
        await pool.query(`
          UPDATE public.tbl_control_panel_config
          SET 
            setting_value = $1,
            updated_at = NOW()
          WHERE LOWER(module_code) = LOWER($2) AND setting_key = $3;
        `, [String(val), moduleCode, key]);
      }

      // Synchronize with specialized tables if applicable
      if (moduleCode === 'user_management') {
        const boolVal = (key: string) => settings[key] !== undefined ? String(settings[key]) === 'true' : null;
        const strVal = (key: string) => settings[key] !== undefined ? String(settings[key]) : null;
        const numVal = (key: string) => settings[key] !== undefined ? Number(settings[key]) : null;

        await pool.query(`
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
            updated_at = NOW()
          WHERE id = (SELECT id FROM public.tbl_user_control_mst ORDER BY id ASC LIMIT 1);
        `, [
          boolVal('is_auto_user_code'),
          strVal('user_code_prefix'),
          numVal('user_code_length'),
          boolVal('allow_manual_code_override'),
          boolVal('allow_closed_code_reuse'),
          boolVal('require_employee_validation'),
          boolVal('auto_fetch_employee_name'),
          boolVal('require_reporting_manager'),
          boolVal('require_region_assignment'),
          strVal('default_role_code'),
        ]);
      }

      res.status(200).json({
        success: true,
        message: `Control panel settings for "${moduleCode}" updated successfully.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * POST /api/control-panel/modules/:moduleCode/reset
   * Resets module settings to system default values
   */
  public static async resetModuleSettings(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const moduleCode = String(req.params['moduleCode'] || '').trim().toLowerCase();

      await pool.query(`
        UPDATE public.tbl_control_panel_config
        SET 
          setting_value = default_value,
          updated_at = NOW()
        WHERE LOWER(module_code) = LOWER($1);
      `, [moduleCode]);

      // If user management, reset user control table
      if (moduleCode === 'user_management') {
        await pool.query(`
          UPDATE public.tbl_user_control_mst
          SET 
            is_auto_user_code = true,
            user_code_prefix = 'USR',
            user_code_length = 4,
            allow_manual_code_override = true,
            allow_closed_code_reuse = true,
            require_employee_validation = true,
            auto_fetch_employee_name = true,
            require_reporting_manager = false,
            require_region_assignment = false,
            default_role_code = 'OPERATOR',
            updated_at = NOW()
          WHERE id = (SELECT id FROM public.tbl_user_control_mst ORDER BY id ASC LIMIT 1);
        `);
      }

      res.status(200).json({
        success: true,
        message: `Settings for "${moduleCode}" have been reset to factory defaults.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * GET /api/setup-module/overview
   * Returns overview data for Setup Module hub
   */
  public static async getSetupOverview(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;

      // Module counts
      const modRes = await pool.query(`
        SELECT COUNT(*)::int AS total_modules FROM public.tbl_control_module_mst WHERE is_active = TRUE;
      `);

      // Total policies
      const settingRes = await pool.query(`
        SELECT COUNT(*)::int AS total_settings FROM public.tbl_control_panel_config WHERE is_active = TRUE;
      `);

      // Submenus in Setup / Options
      const subMenusRes = await pool.query(`
        SELECT sm.sub_menu_id, sm.sub_menu_name, sm.route_path, sm.icon_name, sm.description
        FROM public.tbl_sub_menu_mst sm
        JOIN public.tbl_menu_mst_header h ON sm.header_id = h.header_id
        WHERE h.header_name = 'Options' OR h.header_name = 'System Masters'
        ORDER BY h.display_order, sm.display_order;
      `);

      res.status(200).json({
        success: true,
        data: {
          total_modules: modRes.rows[0]?.total_modules || 6,
          total_settings: settingRes.rows[0]?.total_settings || 35,
          submenus: subMenusRes.rows,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }
}
