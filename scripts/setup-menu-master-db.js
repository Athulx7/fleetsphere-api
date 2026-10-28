import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'athul@2004',
  database: 'fleetsphere_clineta',
});

async function setup() {
  console.log('--- Setting up Menu Master tables and initial seeds on fleetsphere_clineta ---');

  // 1. Menu Header Table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_menu_mst_header (
      header_id      SERIAL PRIMARY KEY,
      header_name    VARCHAR(100) NOT NULL UNIQUE,
      header_code    VARCHAR(50),
      icon_name      VARCHAR(50) DEFAULT 'LayoutDashboard',
      display_order  INTEGER DEFAULT 1,
      is_active      BOOLEAN DEFAULT TRUE,
      created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
  console.log('✓ Created public.tbl_menu_mst_header');

  // 2. Sub-Menu Table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_sub_menu_mst (
      sub_menu_id    SERIAL PRIMARY KEY,
      header_id      INTEGER NOT NULL REFERENCES public.tbl_menu_mst_header(header_id) ON DELETE CASCADE,
      sub_menu_name  VARCHAR(100) NOT NULL,
      route_path     VARCHAR(255) NOT NULL,
      icon_name      VARCHAR(50) DEFAULT 'Layers',
      display_order  INTEGER DEFAULT 1,
      is_sidebar_visible BOOLEAN DEFAULT TRUE,
      description    TEXT,
      is_active      BOOLEAN DEFAULT TRUE,
      created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      CONSTRAINT uq_header_submenu UNIQUE (header_id, sub_menu_name)
    );
  `);
  console.log('✓ Created public.tbl_sub_menu_mst');

  // 3. Role Menu Mapping Table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_role_menu_mapping (
      mapping_id    SERIAL PRIMARY KEY,
      role_id       UUID REFERENCES public.tbl_role_mst(u_role_id) ON DELETE CASCADE,
      role_code     VARCHAR(50) NOT NULL,
      sub_menu_id   INTEGER NOT NULL REFERENCES public.tbl_sub_menu_mst(sub_menu_id) ON DELETE CASCADE,
      can_view      BOOLEAN DEFAULT TRUE,
      can_add       BOOLEAN DEFAULT TRUE,
      can_edit      BOOLEAN DEFAULT TRUE,
      can_delete    BOOLEAN DEFAULT TRUE,
      is_active     BOOLEAN DEFAULT TRUE,
      created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      CONSTRAINT uq_role_submenu UNIQUE (role_code, sub_menu_id)
    );
  `);
  console.log('✓ Created public.tbl_role_menu_mapping');

  // 4. Employee Menu Mapping Table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_employee_menu_mapping (
      mapping_id    SERIAL PRIMARY KEY,
      employee_id   UUID NOT NULL REFERENCES public.tbl_employee_mst(u_employee_id) ON DELETE CASCADE,
      sub_menu_id   INTEGER NOT NULL REFERENCES public.tbl_sub_menu_mst(sub_menu_id) ON DELETE CASCADE,
      is_granted    BOOLEAN DEFAULT TRUE,
      can_view      BOOLEAN DEFAULT TRUE,
      can_add       BOOLEAN DEFAULT TRUE,
      can_edit      BOOLEAN DEFAULT TRUE,
      can_delete    BOOLEAN DEFAULT TRUE,
      is_active     BOOLEAN DEFAULT TRUE,
      created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      CONSTRAINT uq_emp_submenu UNIQUE (employee_id, sub_menu_id)
    );
  `);
  console.log('✓ Created public.tbl_employee_menu_mapping');

  // 5. Seed Menu Headers
  const headers = [
    { name: 'Main', code: 'main', icon: 'LayoutDashboard', order: 1 },
    { name: 'Masters', code: 'masters', icon: 'Layers', order: 2 },
    { name: 'Organization', code: 'org', icon: 'FileText', order: 3 },
  ];

  const headerIdMap = {};
  for (const h of headers) {
    const res = await pool.query(
      `INSERT INTO public.tbl_menu_mst_header (header_name, header_code, icon_name, display_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (header_name) DO UPDATE 
       SET header_code = EXCLUDED.header_code,
           icon_name = EXCLUDED.icon_name,
           display_order = EXCLUDED.display_order,
           updated_at = NOW()
       RETURNING header_id, header_name;`,
      [h.name, h.code, h.icon, h.order]
    );
    headerIdMap[h.name] = res.rows[0].header_id;
  }
  console.log('✓ Seeded Menu Headers:', headerIdMap);

  // 6. Seed Sub-Menus
  const subMenus = [
    // Under Main
    { header: 'Main', name: 'Dashboard', route: '/dashboard', icon: 'LayoutDashboard', order: 1 },
    { header: 'Main', name: 'Employees', route: '/employees', icon: 'Users', order: 2 },
    { header: 'Main', name: 'Attendance', route: '/attendance', icon: 'Clock', order: 3 },
    { header: 'Main', name: 'Payroll', route: '/payroll', icon: 'DollarSign', order: 4 },
    // Under Masters (including the hierarchy menu requested!)
    { header: 'Masters', name: 'Hierarchy Master', route: '/master/hierarchy', icon: 'Layers', order: 1 },
    { header: 'Masters', name: 'Menu Master', route: '/master/menus', icon: 'Grid3X3', order: 2 },
    // Under Organization
    { header: 'Organization', name: 'Documents', route: '/documents', icon: 'FileText', order: 1 },
    { header: 'Organization', name: 'Calendar', route: '/calendar', icon: 'Calendar', order: 2 },
    { header: 'Organization', name: 'Settings', route: '/settings', icon: 'Settings', order: 3 },
  ];

  const subMenuIds = [];
  for (const sm of subMenus) {
    const headerId = headerIdMap[sm.header];
    if (!headerId) continue;

    const res = await pool.query(
      `INSERT INTO public.tbl_sub_menu_mst (header_id, sub_menu_name, route_path, icon_name, display_order)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (header_id, sub_menu_name) DO UPDATE 
       SET route_path = EXCLUDED.route_path,
           icon_name = EXCLUDED.icon_name,
           display_order = EXCLUDED.display_order,
           updated_at = NOW()
       RETURNING sub_menu_id, sub_menu_name;`,
      [headerId, sm.name, sm.route, sm.icon, sm.order]
    );
    subMenuIds.push(res.rows[0].sub_menu_id);
  }
  console.log(`✓ Seeded ${subMenuIds.length} Sub-Menus.`);

  // 7. Map all Sub-Menus to ADMIN Role
  const roleRes = await pool.query(`SELECT u_role_id, c_role_code FROM public.tbl_role_mst WHERE c_role_code = 'ADMIN' LIMIT 1;`);
  if (roleRes.rows.length > 0) {
    const adminRoleId = roleRes.rows[0].u_role_id;
    for (const smId of subMenuIds) {
      await pool.query(
        `INSERT INTO public.tbl_role_menu_mapping (role_id, role_code, sub_menu_id, can_view, can_add, can_edit, can_delete, is_active)
         VALUES ($1, 'ADMIN', $2, TRUE, TRUE, TRUE, TRUE, TRUE)
         ON CONFLICT (role_code, sub_menu_id) DO UPDATE
         SET can_view = TRUE, can_add = TRUE, can_edit = TRUE, can_delete = TRUE, is_active = TRUE, updated_at = NOW();`,
        [adminRoleId, smId]
      );
    }
    console.log(`✓ Mapped all ${subMenuIds.length} sub-menus to ADMIN role.`);
  }

  // 8. Map all Sub-Menus to first employee (ADM001)
  const empRes = await pool.query(`SELECT u_employee_id FROM public.tbl_employee_mst LIMIT 1;`);
  if (empRes.rows.length > 0) {
    const empId = empRes.rows[0].u_employee_id;
    for (const smId of subMenuIds) {
      await pool.query(
        `INSERT INTO public.tbl_employee_menu_mapping (employee_id, sub_menu_id, is_granted, can_view, can_add, can_edit, can_delete, is_active)
         VALUES ($1, $2, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE)
         ON CONFLICT (employee_id, sub_menu_id) DO UPDATE
         SET is_granted = TRUE, can_view = TRUE, is_active = TRUE, updated_at = NOW();`,
        [empId, smId]
      );
    }
    console.log(`✓ Mapped all ${subMenuIds.length} sub-menus to employee ${empId}.`);
  }

  console.log('--- Menu Master Database setup successfully completed! ---');
  await pool.end();
}

setup().catch(err => {
  console.error('Migration failed:', err);
  pool.end();
});
