import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'athul@2004',
  database: 'fleetsphere_clineta'
});

async function check() {
  const headers = await pool.query('SELECT header_id, header_name, header_code, display_order FROM tbl_menu_mst_header ORDER BY display_order');
  console.log('Headers:', headers.rows);

  const submenus = await pool.query(`
    SELECT sm.sub_menu_id, sm.sub_menu_name, sm.route_path, sm.is_sidebar_visible, sm.display_order, h.header_name
    FROM tbl_sub_menu_mst sm
    JOIN tbl_menu_mst_header h ON sm.header_id = h.header_id
    ORDER BY h.display_order, sm.display_order;
  `);
  console.log('Submenus count:', submenus.rows.length);
  submenus.rows.forEach(s => {
    console.log(`[${s.header_name}] ${s.sub_menu_name.padEnd(25)} -> ${s.route_path.padEnd(25)} (sidebar=${s.is_sidebar_visible})`);
  });

  await pool.end();
}

check().catch(console.error);

