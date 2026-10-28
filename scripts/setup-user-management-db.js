import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'athul@2004',
  database: 'fleetsphere_clineta'
});

async function main() {
  console.log('=== SETTING UP USER MANAGEMENT MODULE DATABASE ===\n');

  // 1. Create Multi-Tenant User Control Configuration Master
  console.log('--- 1. Creating tbl_user_control_mst ---');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_user_control_mst (
      id                          SERIAL PRIMARY KEY,
      control_code                VARCHAR(50) NOT NULL UNIQUE DEFAULT 'DEFAULT_CONFIG',
      tenant_code                 VARCHAR(50) DEFAULT 'default',
      is_auto_user_code           BOOLEAN DEFAULT TRUE,
      user_code_prefix            VARCHAR(20) DEFAULT 'USR',
      user_code_length            INTEGER DEFAULT 4,
      allow_manual_code_override  BOOLEAN DEFAULT TRUE,
      allow_closed_code_reuse     BOOLEAN DEFAULT TRUE,
      require_employee_validation BOOLEAN DEFAULT TRUE,
      auto_fetch_employee_name    BOOLEAN DEFAULT TRUE,
      require_reporting_manager   BOOLEAN DEFAULT FALSE,
      require_region_assignment   BOOLEAN DEFAULT FALSE,
      default_role_code           VARCHAR(50) DEFAULT 'OPERATOR',
      description                 TEXT,
      is_active                   BOOLEAN DEFAULT TRUE,
      created_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // Seed default control config if not exists
  await pool.query(`
    INSERT INTO public.tbl_user_control_mst 
      (control_code, tenant_code, is_auto_user_code, user_code_prefix, user_code_length,
       allow_manual_code_override, allow_closed_code_reuse, require_employee_validation,
       auto_fetch_employee_name, require_reporting_manager, require_region_assignment,
       default_role_code, description)
    VALUES
      ('DEFAULT_CONFIG', 'default', true, 'USR', 4,
       true, true, true,
       true, false, false,
       'OPERATOR', 'Default multi-tenant user provisioning and lifecycle policy')
    ON CONFLICT (control_code) DO NOTHING;
  `);
  console.log('✓ tbl_user_control_mst created & seeded.');

  // 2. Create User Profile Management Table
  console.log('\n--- 2. Creating tbl_user_profile_mst ---');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_user_profile_mst (
      id                    SERIAL PRIMARY KEY,
      user_code             VARCHAR(50) NOT NULL,
      employee_id           INTEGER NOT NULL REFERENCES public.tbl_employee_master(id) ON DELETE CASCADE,
      user_name             VARCHAR(150) NOT NULL,
      email                 VARCHAR(150) NOT NULL,
      phone_number          VARCHAR(50),
      reporting_manager_id  INTEGER REFERENCES public.tbl_user_profile_mst(id) ON DELETE SET NULL,
      reporting_emp_id      INTEGER REFERENCES public.tbl_employee_master(id) ON DELETE SET NULL,
      region_id             INTEGER REFERENCES public.tbl_region_mst(id) ON DELETE SET NULL,
      area_id               INTEGER REFERENCES public.tbl_area_mst(id) ON DELETE SET NULL,
      branch_id             INTEGER REFERENCES public.tbl_branch_mst(id) ON DELETE SET NULL,
      shift_id              INTEGER REFERENCES public.tbl_shift_mst(id) ON DELETE SET NULL,
      role_code             VARCHAR(50) DEFAULT 'OPERATOR',
      user_status           VARCHAR(20) DEFAULT 'ACTIVE', -- 'ACTIVE', 'CLOSED', 'SUSPENDED'
      close_reason          TEXT,
      closed_at             TIMESTAMP WITH TIME ZONE,
      closed_by             VARCHAR(100),
      reopened_at           TIMESTAMP WITH TIME ZONE,
      reopened_by           VARCHAR(100),
      notes                 TEXT,
      is_active             BOOLEAN DEFAULT TRUE,
      created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profile_active_code 
    ON public.tbl_user_profile_mst (user_code) 
    WHERE user_status = 'ACTIVE';

    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profile_active_emp 
    ON public.tbl_user_profile_mst (employee_id) 
    WHERE user_status = 'ACTIVE';
  `);
  console.log('✓ tbl_user_profile_mst created.');

  // 3. Seed Sample User Profiles
  console.log('\n--- 3. Seeding Sample User Profiles ---');
  const empRes = await pool.query(`
    SELECT id, employee_code, first_name, last_name, email, phone_number,
           designation_id, branch_id, region_id, area_id, shift_id
    FROM public.tbl_employee_master
    ORDER BY id ASC;
  `);

  if (empRes.rows.length >= 3) {
    const e1 = empRes.rows[0]; // Manager
    const e2 = empRes.rows[1]; // Supervisor
    const e3 = empRes.rows[2]; // Driver

    // User 1: Manager
    const u1Res = await pool.query(`
      INSERT INTO public.tbl_user_profile_mst 
        (user_code, employee_id, user_name, email, phone_number,
         region_id, area_id, branch_id, shift_id, role_code, user_status, notes)
      VALUES
        ('USR0001', $1, $2, $3, $4, $5, $6, $7, $8, 'FLEET_MANAGER', 'ACTIVE', 'Primary operations & fleet provisioning lead')
      ON CONFLICT DO NOTHING
      RETURNING id;
    `, [e1.id, `${e1.first_name} ${e1.last_name}`, e1.email, e1.phone_number, e1.region_id, e1.area_id, e1.branch_id, e1.shift_id]);
    const u1Id = u1Res.rows[0]?.id || 1;

    // User 2: Supervisor (reports to User 1)
    const u2Res = await pool.query(`
      INSERT INTO public.tbl_user_profile_mst 
        (user_code, employee_id, user_name, email, phone_number, reporting_manager_id,
         region_id, area_id, branch_id, shift_id, role_code, user_status, notes)
      VALUES
        ('USR0002', $1, $2, $3, $4, $5, $6, $7, $8, $9, 'SUPERVISOR', 'ACTIVE', 'Area dispatch & shift supervisor')
      ON CONFLICT DO NOTHING
      RETURNING id;
    `, [e2.id, `${e2.first_name} ${e2.last_name}`, e2.email, e2.phone_number, u1Id, e2.region_id, e2.area_id, e2.branch_id, e2.shift_id]);
    const u2Id = u2Res.rows[0]?.id || 2;

    // User 3: Driver (reports to User 2)
    await pool.query(`
      INSERT INTO public.tbl_user_profile_mst 
        (user_code, employee_id, user_name, email, phone_number, reporting_manager_id,
         region_id, area_id, branch_id, shift_id, role_code, user_status, notes)
      VALUES
        ('USR0003', $1, $2, $3, $4, $5, $6, $7, $8, $9, 'DRIVER', 'ACTIVE', 'Line-haul transport specialist')
      ON CONFLICT DO NOTHING;
    `, [e3.id, `${e3.first_name} ${e3.last_name}`, e3.email, e3.phone_number, u2Id, e3.region_id, e3.area_id, e3.branch_id, e3.shift_id]);

    console.log('✓ Active sample users provisioned (USR0001 -> USR0002 -> USR0003).');
  }

  // 4. Register Sub-menu for User Management
  console.log('\n--- 4. Registering Menu Entry ---');
  const orgHeaderRes = await pool.query(`
    SELECT header_id FROM public.tbl_menu_mst_header WHERE header_name = 'Organization Masters' LIMIT 1;
  `);
  const headerId = orgHeaderRes.rows[0]?.header_id || 6;

  const existRes = await pool.query(`SELECT sub_menu_id FROM public.tbl_sub_menu_mst WHERE route_path = '/user-management';`);
  let subMenuId;
  if (existRes.rows.length > 0) {
    subMenuId = existRes.rows[0].sub_menu_id;
    await pool.query(`
      UPDATE public.tbl_sub_menu_mst
      SET sub_menu_name = 'User Management',
          icon_name = 'Users',
          description = 'Staff User Provisioning, Operational Assignment & Access Control',
          updated_at = NOW()
      WHERE sub_menu_id = $1;
    `, [subMenuId]);
  } else {
    const subMenuRes = await pool.query(`
      INSERT INTO public.tbl_sub_menu_mst 
        (header_id, sub_menu_name, route_path, icon_name, display_order, is_active, is_sidebar_visible, description)
      VALUES 
        ($1, 'User Management', '/user-management', 'Users', 19, true, false, 'Staff User Provisioning, Operational Assignment & Access Control')
      RETURNING sub_menu_id;
    `, [headerId]);
    subMenuId = subMenuRes.rows[0]?.sub_menu_id;
  }

  // Grant access to ADMIN role
  if (subMenuId) {
    const roleRes = await pool.query(`SELECT u_role_id FROM public.tbl_role_mst WHERE c_role_code = 'ADMIN' LIMIT 1;`);
    const adminRoleId = roleRes.rows[0]?.u_role_id || null;

    await pool.query(`
      INSERT INTO public.tbl_role_menu_mapping 
        (role_id, role_code, sub_menu_id, can_view, can_add, can_edit, can_delete, is_active)
      VALUES 
        ($1, 'ADMIN', $2, true, true, true, true, true)
      ON CONFLICT (role_code, sub_menu_id) DO UPDATE SET 
        can_view = true, can_add = true, can_edit = true, can_delete = true, is_active = true, updated_at = NOW();
    `, [adminRoleId, subMenuId]);

    const empRes = await pool.query(`SELECT u_employee_id FROM public.tbl_employee_mst LIMIT 1;`);
    if (empRes.rows.length > 0) {
      const empId = empRes.rows[0].u_employee_id;
      await pool.query(`
        INSERT INTO public.tbl_employee_menu_mapping 
          (employee_id, sub_menu_id, is_granted, can_view, can_add, can_edit, can_delete, is_active)
        VALUES 
          ($1, $2, true, true, true, true, true, true)
        ON CONFLICT (employee_id, sub_menu_id) DO UPDATE SET 
          is_granted = true, can_view = true, is_active = true, updated_at = NOW();
      `, [empId, subMenuId]);
    }

    console.log('✓ Menu entry "User Management" (/user-management) registered & mapped to ADMIN.');
  }

  console.log('\n=== USER MANAGEMENT DATABASE CONFIGURATION COMPLETE ===');
  await pool.end();
}

main().catch(err => {
  console.error('Setup error:', err);
  process.exit(1);
});
