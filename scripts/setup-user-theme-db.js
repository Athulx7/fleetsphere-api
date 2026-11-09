import pg from 'pg';
const { Pool } = pg;

const targetDb = process.argv[2] || process.env.TENANT_DB_NAME || 'fleetsphere_clientA';

const pool = new Pool({
  host: process.env.TENANT_DB_HOST || 'localhost',
  port: Number(process.env.TENANT_DB_PORT) || 5432,
  user: process.env.TENANT_DB_USER || 'postgres',
  password: process.env.TENANT_DB_PASSWORD || process.env.ADMIN_DB_PASSWORD || 'csq@123',
  database: targetDb,
});

async function main() {
  console.log(`=== SETTING UP USER THEME PREFERENCES ON ${targetDb} ===\n`);

  // 1. Create tbl_user_theme_preferences
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_user_theme_preferences (
      id                  SERIAL PRIMARY KEY,
      user_id             UUID NOT NULL REFERENCES public.tbl_user_mst(u_user_id) ON DELETE CASCADE UNIQUE,
      header_color        VARCHAR(20) DEFAULT 'dark',      -- 'dark' | 'light'
      menu_color          VARCHAR(20) DEFAULT 'light',     -- 'dark' | 'light'
      color_mode          VARCHAR(20) DEFAULT 'light',     -- 'dark' | 'light'
      layout              VARCHAR(30) DEFAULT 'sidebar',   -- 'sidebar' | 'top_menu' | 'dual_sidebar' | 'minimal'
      sidebar_width       VARCHAR(20) DEFAULT 'expanded',  -- 'expanded' | 'collapsed'
      font_family         VARCHAR(50) DEFAULT 'Plus Jakarta Sans',
      accent_color        VARCHAR(20) DEFAULT '#187f65',
      custom_settings     JSONB DEFAULT '{}'::jsonb,
      created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
  console.log('✓ Created public.tbl_user_theme_preferences table');

  // 2. Ensure default record exists for current active users
  const users = await pool.query(`SELECT u_user_id, c_email FROM public.tbl_user_mst;`);
  for (const u of users.rows) {
    await pool.query(`
      INSERT INTO public.tbl_user_theme_preferences (user_id, header_color, menu_color, color_mode, layout, sidebar_width, font_family, accent_color)
      VALUES ($1, 'dark', 'light', 'light', 'sidebar', 'expanded', 'Plus Jakarta Sans', '#187f65')
      ON CONFLICT (user_id) DO NOTHING;
    `, [u.u_user_id]);
  }
  console.log(`✓ Seeded default theme preferences for ${users.rows.length} existing users.`);

  // 3. Register 'Theme Style' under Main or Options Sub-Menu if desired
  const optHeaderRes = await pool.query(`SELECT header_id FROM public.tbl_menu_mst_header WHERE header_name = 'Options' LIMIT 1;`);
  if (optHeaderRes.rows.length > 0) {
    const optHeaderId = optHeaderRes.rows[0].header_id;
    const smRes = await pool.query(`
      INSERT INTO public.tbl_sub_menu_mst 
        (header_id, sub_menu_name, route_path, icon_name, display_order, is_active, is_sidebar_visible, description)
      VALUES 
        ($1, 'Theme Style', '/theme-style', 'Palette', 3, true, false, 'Personalize workspace layout, header/menu colors, fonts and accents')
      ON CONFLICT (header_id, sub_menu_name) DO UPDATE SET
        route_path = EXCLUDED.route_path,
        icon_name = EXCLUDED.icon_name,
        display_order = EXCLUDED.display_order,
        description = EXCLUDED.description
      RETURNING sub_menu_id;
    `, [optHeaderId]);

    const subMenuId = smRes.rows[0]?.sub_menu_id;
    if (subMenuId) {
      // Map to ADMIN role and ALL roles
      const roles = await pool.query(`SELECT u_role_id, c_role_code FROM public.tbl_role_mst;`);
      for (const r of roles.rows) {
        await pool.query(`
          INSERT INTO public.tbl_role_menu_mapping (role_id, role_code, sub_menu_id, can_view, can_add, can_edit, can_delete, is_active)
          VALUES ($1, $2, $3, true, true, true, true, true)
          ON CONFLICT (role_code, sub_menu_id) DO UPDATE SET can_view = true, is_active = true, updated_at = NOW();
        `, [r.u_role_id, r.c_role_code, subMenuId]);
      }

      // Map to employees
      const emps = await pool.query(`SELECT u_employee_id FROM public.tbl_employee_mst;`);
      for (const e of emps.rows) {
        await pool.query(`
          INSERT INTO public.tbl_employee_menu_mapping (employee_id, sub_menu_id, is_granted, can_view, can_add, can_edit, can_delete, is_active)
          VALUES ($1, $2, true, true, true, true, true, true)
          ON CONFLICT (employee_id, sub_menu_id) DO UPDATE SET is_granted = true, can_view = true, is_active = true, updated_at = NOW();
        `, [e.u_employee_id, subMenuId]);
      }
      console.log('✓ Registered "Theme Style" menu entry & granted to all roles and employees.');
    }
  }

  console.log(`=== THEME PREFERENCES SETUP COMPLETE ON ${targetDb} ===\n`);
  await pool.end();
}

main().catch(err => {
  console.error('Setup error:', err);
  process.exit(1);
});

