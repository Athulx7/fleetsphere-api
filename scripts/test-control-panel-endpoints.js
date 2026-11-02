import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'athul@2004',
  database: 'fleetsphere_clineta'
});

async function testApi() {
  console.log('=== VERIFYING CONTROL PANEL & SETUP MODULE DATA & SYNC ===\n');

  // 1. Check modules list
  const mods = await pool.query(`
    SELECT 
      m.id,
      m.module_code,
      m.module_name,
      m.icon_name,
      m.category,
      COUNT(c.id)::int AS settings_count
    FROM public.tbl_control_module_mst m
    LEFT JOIN public.tbl_control_panel_config c ON m.module_code = c.module_code
    WHERE m.is_active = TRUE
    GROUP BY m.id
    ORDER BY m.display_order ASC;
  `);

  console.log(`Configured Static Modules (${mods.rows.length}):`);
  mods.rows.forEach(m => {
    console.log(`  • [${m.module_code}] ${m.module_name.padEnd(25)} (${m.category}) - ${m.settings_count} controls`);
  });

  // 2. Check User Management Settings
  const userSettings = await pool.query(`
    SELECT setting_key, setting_label, setting_type, setting_value, group_name
    FROM public.tbl_control_panel_config
    WHERE module_code = 'user_management'
    ORDER BY display_order;
  `);

  console.log(`\nUser Management Settings (${userSettings.rows.length}):`);
  userSettings.rows.forEach(s => {
    console.log(`  - [${s.group_name}] ${s.setting_key.padEnd(28)} = ${s.setting_value.padEnd(10)} (${s.setting_type})`);
  });

  // 3. Check Submenus under Options
  const subMenus = await pool.query(`
    SELECT sm.sub_menu_id, sm.sub_menu_name, sm.route_path, sm.is_sidebar_visible, h.header_name
    FROM public.tbl_sub_menu_mst sm
    JOIN public.tbl_menu_mst_header h ON sm.header_id = h.header_id
    WHERE h.header_name = 'Options'
    ORDER BY sm.display_order;
  `);

  console.log(`\nOptions Header Submenus (${subMenus.rows.length}):`);
  subMenus.rows.forEach(sm => {
    console.log(`  • ${sm.sub_menu_name.padEnd(20)} -> ${sm.route_path} (sidebar_visible=${sm.is_sidebar_visible})`);
  });

  await pool.end();
}

testApi().catch(console.error);
