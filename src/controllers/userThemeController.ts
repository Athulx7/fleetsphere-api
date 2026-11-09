import type { Request, Response } from 'express';
import type { ApiResponse } from '../types/auth.js';

export interface UserThemePreferences {
  header_color: 'dark' | 'light';
  menu_color: 'dark' | 'light';
  color_mode: 'dark' | 'light';
  layout: 'sidebar' | 'top_menu' | 'dual_sidebar' | 'minimal';
  sidebar_width: 'expanded' | 'collapsed';
  font_family: string;
  accent_color: string;
  custom_settings?: Record<string, unknown>;
}

export class UserThemeController {
  private static readonly DEFAULTS: UserThemePreferences = {
    header_color: 'dark',
    menu_color: 'light',
    color_mode: 'light',
    layout: 'sidebar',
    sidebar_width: 'expanded',
    font_family: 'Plus Jakarta Sans',
    accent_color: '#187f65',
    custom_settings: {},
  };

  /**
   * GET /api/user/theme-preferences
   * Retrieves theme preferences for the currently authenticated user
   */
  public static async getPreferences(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const userId = req.tenantContext.user.userId;

      const result = await pool.query(
        `SELECT 
          header_color, 
          menu_color, 
          color_mode, 
          layout, 
          sidebar_width, 
          font_family, 
          accent_color, 
          custom_settings,
          updated_at
         FROM public.tbl_user_theme_preferences
         WHERE user_id = $1
         LIMIT 1;`,
        [userId]
      );

      if (result.rows.length === 0) {
        res.status(200).json({
          success: true,
          data: UserThemeController.DEFAULTS,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.rows[0],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * POST /api/user/theme-preferences
   * Saves or updates theme preferences for the currently authenticated user
   */
  public static async savePreferences(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    const {
      header_color = 'dark',
      menu_color = 'light',
      color_mode = 'light',
      layout = 'sidebar',
      sidebar_width = 'expanded',
      font_family = 'Plus Jakarta Sans',
      accent_color = '#187f65',
      custom_settings = {},
    } = req.body || {};

    try {
      const pool = req.tenantContext.db;
      const userId = req.tenantContext.user.userId;

      const result = await pool.query(
        `INSERT INTO public.tbl_user_theme_preferences
           (user_id, header_color, menu_color, color_mode, layout, sidebar_width, font_family, accent_color, custom_settings, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           header_color = EXCLUDED.header_color,
           menu_color = EXCLUDED.menu_color,
           color_mode = EXCLUDED.color_mode,
           layout = EXCLUDED.layout,
           sidebar_width = EXCLUDED.sidebar_width,
           font_family = EXCLUDED.font_family,
           accent_color = EXCLUDED.accent_color,
           custom_settings = EXCLUDED.custom_settings,
           updated_at = NOW()
         RETURNING header_color, menu_color, color_mode, layout, sidebar_width, font_family, accent_color, custom_settings, updated_at;`,
        [userId, header_color, menu_color, color_mode, layout, sidebar_width, font_family, accent_color, JSON.stringify(custom_settings)]
      );

      res.status(200).json({
        success: true,
        message: 'Theme preferences saved successfully',
        data: result.rows[0],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * DELETE /api/user/theme-preferences
   * Resets theme preferences back to defaults for the currently authenticated user
   */
  public static async resetPreferences(req: Request, res: Response<ApiResponse>): Promise<void> {
    if (!req.tenantContext) {
      res.status(401).json({ success: false, message: 'Tenant context is missing' });
      return;
    }

    try {
      const pool = req.tenantContext.db;
      const userId = req.tenantContext.user.userId;

      await pool.query(
        `DELETE FROM public.tbl_user_theme_preferences WHERE user_id = $1;`,
        [userId]
      );

      res.status(200).json({
        success: true,
        message: 'Theme preferences reset to default',
        data: UserThemeController.DEFAULTS,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message: msg });
    }
  }
}

