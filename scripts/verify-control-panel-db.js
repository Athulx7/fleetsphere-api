import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'athul@2004',
  database: 'fleetsphere_clineta'
});

async function verify() {
  const mods = await pool.query('SELECT module_code, module_name, category, (SELECT COUNT(*) FROM tbl_control_panel_config c WHERE c.module_code = m.module_code) as settings_count FROM tbl_control_module_mst m ORDER BY display_order');
  console.log('Modules configured:', mods.rows);

  const submenus = await pool.query(`
    SELECT sm.sub_menu_id, sm.sub_menu_name, sm.route_path, h.header_name, h.display_order
    FROM tbl_sub_menu_mst sm
    JOIN tbl_menu_mst_header h ON sm.header_id = h.header_id
    WHERE h.header_name = 'Options'
    ORDER BY sm.display_order;
  `);
  console.log('\nOptions submenus:', submenus.rows);

  await pool.end();
}

verify().catch(console.error);
