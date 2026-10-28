import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'athul@2004',
  database: 'fleetsphere_clineta',
});

async function run() {
  console.log('--- Altering tbl_sub_menu_mst table ---');

  // Add is_sidebar_visible column
  await pool.query(`
    ALTER TABLE public.tbl_sub_menu_mst 
    ADD COLUMN IF NOT EXISTS is_sidebar_visible BOOLEAN DEFAULT TRUE;
  `);
  console.log('✓ Added or confirmed is_sidebar_visible column');

  // Add description column
  await pool.query(`
    ALTER TABLE public.tbl_sub_menu_mst 
    ADD COLUMN IF NOT EXISTS description TEXT;
  `);
  console.log('✓ Added or confirmed description column');

  // Populate descriptions and default visibility
  const descriptions = [
    {
      name: 'Dashboard',
      desc: 'Overview of key fleet metrics, operational status, and real-time summaries',
      sidebar: true,
      order: 1,
    },
    {
      name: 'Employees',
      desc: 'Manage workforce, drivers, staff profiles, and assignments',
      sidebar: true,
      order: 2,
    },
    {
      name: 'Attendance',
      desc: 'Track driver and staff check-ins, shifts, and attendance logs',
      sidebar: true,
      order: 3,
    },
    {
      name: 'Payroll',
      desc: 'Manage compensation, salary structures, bonuses, and payslips',
      sidebar: true,
      order: 4,
    },
    {
      name: 'Hierarchy Master',
      desc: 'Configure organizational units, branches, and departmental trees',
      sidebar: true,
      order: 5,
    },
    {
      name: 'Documents',
      desc: 'Manage vehicle compliance, driver licenses, and company records',
      sidebar: true,
      order: 6,
    },
    {
      name: 'Calendar',
      desc: 'Schedule trips, vehicle maintenance, shifts, and holiday tracking',
      sidebar: true,
      order: 7,
    },
    {
      name: 'Settings',
      desc: 'Manage company configurations, system preferences, and security settings',
      sidebar: true,
      order: 8,
    },
    {
      name: 'Menu Master',
      desc: 'Manage role and employee access permissions, sidebar visibility, and menu display order',
      sidebar: false, // 8 menus shown in sidebar by default, Menu Master accessible from MainMenu!
      order: 9,
    },
  ];

  for (const item of descriptions) {
    await pool.query(
      `UPDATE public.tbl_sub_menu_mst 
       SET description = $1,
           is_sidebar_visible = $2,
           display_order = $3,
           updated_at = NOW()
       WHERE sub_menu_name = $4;`,
      [item.desc, item.sidebar, item.order, item.name]
    );
  }

  console.log('✓ Updated descriptions, display_order and is_sidebar_visible for sub-menus');

  const check = await pool.query(`
    SELECT sub_menu_id, sub_menu_name, route_path, display_order, is_sidebar_visible, description
    FROM public.tbl_sub_menu_mst
    ORDER BY display_order ASC;
  `);
  console.log('Current Sub-Menus in DB:');
  console.table(check.rows);

  await pool.end();
}

run().catch((err) => {
  console.error('Failed to alter table:', err);
  pool.end();
});

