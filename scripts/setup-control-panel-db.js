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
  console.log('=== SETTING UP CONTROL PANEL & SETUP MODULE DATABASE ===\n');

  // 1. Create tbl_control_module_mst
  console.log('--- 1. Creating tbl_control_module_mst ---');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_control_module_mst (
      id            SERIAL PRIMARY KEY,
      module_code   VARCHAR(50) NOT NULL UNIQUE,
      module_name   VARCHAR(100) NOT NULL,
      icon_name     VARCHAR(50) DEFAULT 'SlidersHorizontal',
      category      VARCHAR(50) DEFAULT 'Core Operations',
      description   TEXT,
      display_order INTEGER DEFAULT 1,
      is_active     BOOLEAN DEFAULT TRUE,
      created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // 2. Create tbl_control_panel_config
  console.log('\n--- 2. Creating tbl_control_panel_config ---');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_control_panel_config (
      id                  SERIAL PRIMARY KEY,
      module_code         VARCHAR(50) NOT NULL REFERENCES public.tbl_control_module_mst(module_code) ON DELETE CASCADE,
      setting_key         VARCHAR(100) NOT NULL,
      setting_label       VARCHAR(150) NOT NULL,
      setting_description TEXT,
      setting_type        VARCHAR(30) NOT NULL, -- 'toggle', 'text', 'number', 'select'
      setting_value       TEXT NOT NULL,
      default_value       TEXT NOT NULL,
      options_json        JSONB,
      group_name          VARCHAR(100) NOT NULL,
      depends_on_key      VARCHAR(100),
      display_order       INTEGER DEFAULT 1,
      is_active           BOOLEAN DEFAULT TRUE,
      created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE (module_code, setting_key)
    );
  `);

  // 3. Seed Static Modules
  console.log('\n--- 3. Seeding Static Configurable Modules ---');
  const modules = [
    {
      code: 'user_management',
      name: 'User Management',
      icon: 'Users',
      category: 'Identity & Access',
      desc: 'Staff user provisioning, employee validation, auto-numbering, and account lifecycle controls.',
      order: 1,
    },
    {
      code: 'attendance',
      name: 'Attendance Tracker',
      icon: 'Clock',
      category: 'Workforce Operations',
      desc: 'Geofenced sign-in radius, biometric verification, grace intervals, and overtime triggers.',
      order: 2,
    },
    {
      code: 'payroll',
      name: 'Payroll Summary',
      icon: 'DollarSign',
      category: 'Finance & Compensation',
      desc: 'Disbursement frequency, cutoff scheduling, overtime rate multipliers, and loss-of-pay deductions.',
      order: 3,
    },
    {
      code: 'documents',
      name: 'Documents Vault',
      icon: 'FileText',
      category: 'Statutory & Compliance',
      desc: 'Licence expiry alerts, dispatch safety locks, supervisor approval gates, and file quotas.',
      order: 4,
    },
    {
      code: 'calendar',
      name: 'Calendar & Schedules',
      icon: 'Calendar',
      category: 'Workforce Operations',
      desc: 'Operational week layout, shift rotation cycles, split-shift rules, and holiday calendars.',
      order: 5,
    },
    {
      code: 'fleet_dispatch',
      name: 'Fleet Dispatch Operations',
      icon: 'Truck',
      category: 'Fleet & Logistics',
      desc: 'Pre-trip digital checklists, telematics polling frequencies, and transit speed violation limits.',
      order: 6,
    },
  ];

  for (const m of modules) {
    await pool.query(`
      INSERT INTO public.tbl_control_module_mst 
        (module_code, module_name, icon_name, category, description, display_order, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      ON CONFLICT (module_code) 
      DO UPDATE SET
        module_name = EXCLUDED.module_name,
        icon_name = EXCLUDED.icon_name,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        display_order = EXCLUDED.display_order,
        updated_at = NOW();
    `, [m.code, m.name, m.icon, m.category, m.desc, m.order]);
  }
  console.log(`✓ Seeded ${modules.length} static modules into tbl_control_module_mst.`);

  // 4. Seed Detailed Settings for Each Static Module
  console.log('\n--- 4. Seeding Dynamic Module Settings ---');

  const settings = [
    // ------------------------------------------------------------------------
    // USER MANAGEMENT
    // ------------------------------------------------------------------------
    {
      module: 'user_management',
      key: 'is_auto_user_code',
      label: 'Auto-Generate User Code',
      desc: 'Automatically generate sequential user codes according to tenant prefix and padding',
      type: 'toggle',
      val: 'true',
      def: 'true',
      group: 'Identity & Code Generation',
      order: 1,
    },
    {
      module: 'user_management',
      key: 'user_code_prefix',
      label: 'User Code Prefix',
      desc: 'Leading uppercase alphabetical prefix for auto-generated user codes',
      type: 'text',
      val: 'USR',
      def: 'USR',
      group: 'Identity & Code Generation',
      dep: 'is_auto_user_code',
      order: 2,
    },
    {
      module: 'user_management',
      key: 'user_code_length',
      label: 'Sequential Number Padding',
      desc: 'Number of digits in the sequence (e.g. 4 renders USR0001)',
      type: 'number',
      val: '4',
      def: '4',
      group: 'Identity & Code Generation',
      dep: 'is_auto_user_code',
      order: 3,
    },
    {
      module: 'user_management',
      key: 'allow_manual_code_override',
      label: 'Allow Manual Code Override',
      desc: 'Permit authorized administrators to manually type a custom user code even when auto-code is enabled',
      type: 'toggle',
      val: 'true',
      def: 'true',
      group: 'Identity & Code Generation',
      order: 4,
    },
    {
      module: 'user_management',
      key: 'allow_closed_code_reuse',
      label: 'Recycle Closed User Codes',
      desc: 'Allow re-issuing the user code of a previously closed user account to a newly provisioned employee',
      type: 'toggle',
      val: 'true',
      def: 'true',
      group: 'Identity & Code Generation',
      order: 5,
    },
    {
      module: 'user_management',
      key: 'require_employee_validation',
      label: 'Enforce Genuine Employee Validation',
      desc: 'Require that every system user is verified against an active profile in the Employee Master',
      type: 'toggle',
      val: 'true',
      def: 'true',
      group: 'Employee Verification & Binding',
      order: 6,
    },
    {
      module: 'user_management',
      key: 'auto_fetch_employee_name',
      label: 'Auto-Fetch Employee Profile Details',
      desc: 'Automatically pre-fill user name, email, phone number, and branch from verified employee records',
      type: 'toggle',
      val: 'true',
      def: 'true',
      group: 'Employee Verification & Binding',
      order: 7,
    },
    {
      module: 'user_management',
      key: 'require_reporting_manager',
      label: 'Require Reporting Manager',
      desc: 'Block user provisioning unless a valid operational reporting manager is designated',
      type: 'toggle',
      val: 'false',
      def: 'false',
      group: 'Operational Hierarchy & Access',
      order: 8,
    },
    {
      module: 'user_management',
      key: 'require_region_assignment',
      label: 'Require Regional Territory Assignment',
      desc: 'Enforce that an operating geographic region is assigned to the user profile',
      type: 'toggle',
      val: 'false',
      def: 'false',
      group: 'Operational Hierarchy & Access',
      order: 9,
    },
    {
      module: 'user_management',
      key: 'default_role_code',
      label: 'Default Application Role',
      desc: 'Default security role assigned upon completing user provisioning',
      type: 'select',
      val: 'OPERATOR',
      def: 'OPERATOR',
      options: [
        { label: 'Administrator', value: 'ADMIN' },
        { label: 'Fleet Manager', value: 'FLEET_MANAGER' },
        { label: 'Operations Supervisor', value: 'SUPERVISOR' },
        { label: 'Dispatcher', value: 'DISPATCHER' },
        { label: 'Commercial Driver', value: 'DRIVER' },
        { label: 'Standard Operator', value: 'OPERATOR' },
      ],
      group: 'Operational Hierarchy & Access',
      order: 10,
    },

    // ------------------------------------------------------------------------
    // ATTENDANCE TRACKER
    // ------------------------------------------------------------------------
    {
      module: 'attendance',
      key: 'enable_geofence_enforcement',
      label: 'Enforce Geofenced Clock-In',
      desc: 'Restrict mobile attendance clock-ins strictly within designated branch/depot boundary coordinates',
      type: 'toggle',
      val: 'true',
      def: 'true',
      group: 'Clock-In & Biometrics',
      order: 1,
    },
    {
      module: 'attendance',
      key: 'geofence_radius_meters',
      label: 'Depot Geofence Radius (Meters)',
      desc: 'Permissible radius in meters around operating depot location',
      type: 'number',
      val: '150',
      def: '150',
      group: 'Clock-In & Biometrics',
      dep: 'enable_geofence_enforcement',
      order: 2,
    },
    {
      module: 'attendance',
      key: 'grace_period_minutes',
      label: 'Shift Grace Period (Minutes)',
      desc: 'Allowed minutes after scheduled shift start before the record is flagged as Late Arrival',
      type: 'number',
      val: '15',
      def: '15',
      group: 'Clock-In & Biometrics',
      order: 3,
    },
    {
      module: 'attendance',
      key: 'enable_facial_recognition',
      label: 'Facial Biometric Verification',
      desc: 'Require driver/operator photo selfie match verification during mobile shift punch-in',
      type: 'toggle',
      val: 'false',
      def: 'false',
      group: 'Clock-In & Biometrics',
      order: 4,
    },
    {
      module: 'attendance',
      key: 'auto_clockout_hours',
      label: 'Automated Shift Cutoff (Hours)',
      desc: 'Maximum shift duration after which the system automatically logs out unclosed shifts',
      type: 'number',
      val: '14',
      def: '14',
      group: 'Shift & Overtime Rules',
      order: 5,
    },
    {
      module: 'attendance',
      key: 'min_half_day_hours',
      label: 'Half-Day Minimum Hours',
      desc: 'Minimum active shift hours required to qualify for half-day attendance credit',
      type: 'number',
      val: '4',
      def: '4',
      group: 'Shift & Overtime Rules',
      order: 6,
    },
    {
      module: 'attendance',
      key: 'overtime_threshold_minutes',
      label: 'Overtime Trigger Threshold (Minutes)',
      desc: 'Minutes worked beyond scheduled shift end time before overtime computation starts',
      type: 'number',
      val: '45',
      def: '45',
      group: 'Shift & Overtime Rules',
      order: 7,
    },

    // ------------------------------------------------------------------------
    // PAYROLL SUMMARY
    // ------------------------------------------------------------------------
    {
      module: 'payroll',
      key: 'pay_cycle_frequency',
      label: 'Payroll Disbursement Cycle',
      desc: 'Operational recurrence for automated salary calculations and disbursement batching',
      type: 'select',
      val: 'MONTHLY',
      def: 'MONTHLY',
      options: [
        { label: 'Monthly (Calendar End)', value: 'MONTHLY' },
        { label: 'Bi-Weekly (Fortnightly)', value: 'BI_WEEKLY' },
        { label: 'Weekly Pay Run', value: 'WEEKLY' },
      ],
      group: 'Disbursement & Pay Cycle',
      order: 1,
    },
    {
      module: 'payroll',
      key: 'salary_cutoff_day',
      label: 'Monthly Attendance Cutoff Day',
      desc: 'Calendar day of the month when shift and attendance hours lock for payroll processing',
      type: 'number',
      val: '25',
      def: '25',
      group: 'Disbursement & Pay Cycle',
      order: 2,
    },
    {
      module: 'payroll',
      key: 'auto_payslip_generation',
      label: 'Auto-Generate PDF Payslips',
      desc: 'Automatically generate and archive downloadable employee payslips upon payroll approval',
      type: 'toggle',
      val: 'true',
      def: 'true',
      group: 'Disbursement & Pay Cycle',
      order: 3,
    },
    {
      module: 'payroll',
      key: 'overtime_multiplier',
      label: 'Standard Overtime Multiplier',
      desc: 'Hourly rate multiplier applied to verified post-shift operational overtime (e.g. 1.5x)',
      type: 'number',
      val: '1.5',
      def: '1.5',
      group: 'Multipliers & Deductions',
      order: 4,
    },
    {
      module: 'payroll',
      key: 'holiday_work_multiplier',
      label: 'Holiday Work Multiplier',
      desc: 'Hourly rate multiplier applied for line-haul operations on gazetted national holidays (e.g. 2.0x)',
      type: 'number',
      val: '2.0',
      def: '2.0',
      group: 'Multipliers & Deductions',
      order: 5,
    },
    {
      module: 'payroll',
      key: 'enforce_lop_deductions',
      label: 'Enforce Loss-Of-Pay (LOP)',
      desc: 'Automatically deduct unexcused absence days from standard monthly gross salary',
      type: 'toggle',
      val: 'true',
      def: 'true',
      group: 'Multipliers & Deductions',
      order: 6,
    },

    // ------------------------------------------------------------------------
    // DOCUMENTS VAULT
    // ------------------------------------------------------------------------
    {
      module: 'documents',
      key: 'expiry_warning_days',
      label: 'Expiry Advance Warning (Days)',
      desc: 'Advance notice period triggering dashboard alerts before commercial licences or permits expire',
      type: 'number',
      val: '30',
      def: '30',
      group: 'Compliance & Expiry Warnings',
      order: 1,
    },
    {
      module: 'documents',
      key: 'block_dispatch_on_expired_docs',
      label: 'Block Vehicle Dispatch on Expired Documents',
      desc: 'Automatically prevent assigning loads or trips to drivers whose statutory transport licence has expired',
      type: 'toggle',
      val: 'true',
      def: 'true',
      group: 'Compliance & Expiry Warnings',
      order: 2,
    },
    {
      module: 'documents',
      key: 'require_supervisor_approval',
      label: 'Require Supervisor Approval on Re-Upload',
      desc: 'Newly uploaded renewed document proofs require manual operational verification before clearing warnings',
      type: 'toggle',
      val: 'true',
      def: 'true',
      group: 'Compliance & Expiry Warnings',
      order: 3,
    },
    {
      module: 'documents',
      key: 'max_file_size_mb',
      label: 'Max Document Upload Size (MB)',
      desc: 'Maximum individual file size in Megabytes allowed for PDF or image document uploads',
      type: 'number',
      val: '10',
      def: '10',
      group: 'Storage & File Governance',
      order: 4,
    },

    // ------------------------------------------------------------------------
    // CALENDAR & SCHEDULES
    // ------------------------------------------------------------------------
    {
      module: 'calendar',
      key: 'working_days_per_week',
      label: 'Standard Working Days / Week',
      desc: 'Number of active operating days per business week for shift roster planning',
      type: 'number',
      val: '6',
      def: '6',
      group: 'Work Week & Operating Schedules',
      order: 1,
    },
    {
      module: 'calendar',
      key: 'week_start_day',
      label: 'Week Starting Day',
      desc: 'Starting day of the operational week for rosters and schedule rollouts',
      type: 'select',
      val: 'MONDAY',
      def: 'MONDAY',
      options: [
        { label: 'Monday', value: 'MONDAY' },
        { label: 'Sunday', value: 'SUNDAY' },
      ],
      group: 'Work Week & Operating Schedules',
      order: 2,
    },
    {
      module: 'calendar',
      key: 'allow_split_shifts',
      label: 'Enable Split Shifts',
      desc: 'Allow dispatchers to schedule two distinct operational shift intervals for a driver in one day',
      type: 'toggle',
      val: 'false',
      def: 'false',
      group: 'Work Week & Operating Schedules',
      order: 3,
    },
    {
      module: 'calendar',
      key: 'shift_rotation_cycle_weeks',
      label: 'Shift Rotation Interval (Weeks)',
      desc: 'Standard cycle period after which day shift and night express teams alternate rosters',
      type: 'number',
      val: '2',
      def: '2',
      group: 'Work Week & Operating Schedules',
      order: 4,
    },

    // ------------------------------------------------------------------------
    // FLEET DISPATCH OPERATIONS
    // ------------------------------------------------------------------------
    {
      module: 'fleet_dispatch',
      key: 'enforce_pre_trip_inspection',
      label: 'Enforce Pre-Trip Digital Inspection',
      desc: 'Require commercial drivers to submit digital tyre, brake, and oil inspection checklists before trip departure',
      type: 'toggle',
      val: 'true',
      def: 'true',
      group: 'Vehicle Assignment & Safety Rules',
      order: 1,
    },
    {
      module: 'fleet_dispatch',
      key: 'speed_limit_violation_kmh',
      label: 'Speed Limit Alert Threshold (km/h)',
      desc: 'Telematics GPS speed trigger generating immediate dispatcher alerts for vehicle overspeeding',
      type: 'number',
      val: '85',
      def: '85',
      group: 'Vehicle Assignment & Safety Rules',
      order: 2,
    },
    {
      module: 'fleet_dispatch',
      key: 'telematics_ping_interval_sec',
      label: 'GPS Telematics Refresh Rate (Seconds)',
      desc: 'In-transit vehicle location update interval for route telemetry map rendering',
      type: 'number',
      val: '30',
      def: '30',
      group: 'Vehicle Assignment & Safety Rules',
      order: 3,
    },
    {
      module: 'fleet_dispatch',
      key: 'auto_assign_nearest_vehicle',
      label: 'Auto-Propose Nearest Idle Asset',
      desc: 'Automatically suggest nearest idle truck and rested driver based on current GPS distance from pickup depot',
      type: 'toggle',
      val: 'false',
      def: 'false',
      group: 'Vehicle Assignment & Safety Rules',
      order: 4,
    },
  ];

  for (const s of settings) {
    await pool.query(`
      INSERT INTO public.tbl_control_panel_config
        (module_code, setting_key, setting_label, setting_description, setting_type,
         setting_value, default_value, options_json, group_name, depends_on_key, display_order, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
      ON CONFLICT (module_code, setting_key)
      DO UPDATE SET
        setting_label = EXCLUDED.setting_label,
        setting_description = EXCLUDED.setting_description,
        setting_type = EXCLUDED.setting_type,
        options_json = EXCLUDED.options_json,
        group_name = EXCLUDED.group_name,
        depends_on_key = EXCLUDED.depends_on_key,
        display_order = EXCLUDED.display_order,
        updated_at = NOW();
    `, [
      s.module,
      s.key,
      s.label,
      s.desc,
      s.type,
      s.val,
      s.def,
      s.options ? JSON.stringify(s.options) : null,
      s.group,
      s.dep || null,
      s.order,
    ]);
  }
  console.log(`✓ Seeded ${settings.length} dynamic settings into tbl_control_panel_config.`);

  // 5. Register Header 'Options' and Submenus 'Setup Module' & 'Control Panel'
  console.log('\n--- 5. Registering Header Options & Setup Submenus ---');

  // Insert or update 'Options' header
  const optHeaderRes = await pool.query(`
    INSERT INTO public.tbl_menu_mst_header (header_name, header_code, icon_name, display_order, is_active)
    VALUES ('Options', 'options', 'SlidersHorizontal', 5, true)
    ON CONFLICT (header_name)
    DO UPDATE SET
      header_code = EXCLUDED.header_code,
      icon_name = EXCLUDED.icon_name,
      display_order = EXCLUDED.display_order,
      updated_at = NOW()
    RETURNING header_id;
  `);
  const optionsHeaderId = optHeaderRes.rows[0].header_id;
  console.log(`✓ Header "Options" configured with header_id = ${optionsHeaderId}`);

  // Submenu: Setup Module (/setupmodule)
  let smSetupId;
  const qSetup = await pool.query(`SELECT sub_menu_id FROM public.tbl_sub_menu_mst WHERE route_path = '/setupmodule';`);
  if (qSetup.rows.length > 0) {
    smSetupId = qSetup.rows[0].sub_menu_id;
    await pool.query(`
      UPDATE public.tbl_sub_menu_mst 
      SET header_id = $1, sub_menu_name = 'Setup Module', icon_name = 'Settings', display_order = 1, updated_at = NOW()
      WHERE sub_menu_id = $2;
    `, [optionsHeaderId, smSetupId]);
  } else {
    const smSetupRes = await pool.query(`
      INSERT INTO public.tbl_sub_menu_mst 
        (header_id, sub_menu_name, route_path, icon_name, display_order, is_active, is_sidebar_visible, description)
      VALUES 
        ($1, 'Setup Module', '/setupmodule', 'Settings', 1, true, false, 'Enterprise Setup & System Configuration Hub')
      RETURNING sub_menu_id;
    `, [optionsHeaderId]);
    smSetupId = smSetupRes.rows[0].sub_menu_id;
  }

  // Submenu: Control Panel (/ctrl_panel)
  let smCtrlId;
  const qCtrl = await pool.query(`SELECT sub_menu_id FROM public.tbl_sub_menu_mst WHERE route_path = '/ctrl_panel';`);
  if (qCtrl.rows.length > 0) {
    smCtrlId = qCtrl.rows[0].sub_menu_id;
    await pool.query(`
      UPDATE public.tbl_sub_menu_mst 
      SET header_id = $1, sub_menu_name = 'Control Panel', icon_name = 'SlidersHorizontal', display_order = 2, updated_at = NOW()
      WHERE sub_menu_id = $2;
    `, [optionsHeaderId, smCtrlId]);
  } else {
    const smCtrlRes = await pool.query(`
      INSERT INTO public.tbl_sub_menu_mst 
        (header_id, sub_menu_name, route_path, icon_name, display_order, is_active, is_sidebar_visible, description)
      VALUES 
        ($1, 'Control Panel', '/ctrl_panel', 'SlidersHorizontal', 2, true, false, 'Dynamic Module Policies & Operational Control Center')
      RETURNING sub_menu_id;
    `, [optionsHeaderId]);
    smCtrlId = smCtrlRes.rows[0].sub_menu_id;
  }

  // 6. Grant Permissions to ADMIN Role and Employee
  console.log('\n--- 6. Mapping Permissions to ADMIN Role ---');
  const roleRes = await pool.query(`SELECT u_role_id FROM public.tbl_role_mst WHERE c_role_code = 'ADMIN' LIMIT 1;`);
  const adminRoleId = roleRes.rows[0]?.u_role_id || null;

  const empRes = await pool.query(`SELECT u_employee_id FROM public.tbl_employee_mst LIMIT 1;`);
  const empId = empRes.rows[0]?.u_employee_id || null;

  const targetSubMenus = [smSetupId, smCtrlId].filter(Boolean);

  for (const smId of targetSubMenus) {
    await pool.query(`
      INSERT INTO public.tbl_role_menu_mapping 
        (role_id, role_code, sub_menu_id, can_view, can_add, can_edit, can_delete, is_active)
      VALUES 
        ($1, 'ADMIN', $2, true, true, true, true, true)
      ON CONFLICT (role_code, sub_menu_id) DO UPDATE SET 
        can_view = true, can_add = true, can_edit = true, can_delete = true, is_active = true, updated_at = NOW();
    `, [adminRoleId, smId]);

    if (empId) {
      await pool.query(`
        INSERT INTO public.tbl_employee_menu_mapping 
          (employee_id, sub_menu_id, is_granted, can_view, can_add, can_edit, can_delete, is_active)
        VALUES 
          ($1, $2, true, true, true, true, true, true)
        ON CONFLICT (employee_id, sub_menu_id) DO UPDATE SET 
          is_granted = true, can_view = true, is_active = true, updated_at = NOW();
      `, [empId, smId]);
    }
  }

  console.log(`✓ Submenus [Setup Module, Control Panel] mapped to ADMIN role.`);
  console.log('\n=== CONTROL PANEL DATABASE SETUP COMPLETED SUCCESSFULLY ===');
  await pool.end();
}

main().catch(err => {
  console.error('Setup error:', err);
  process.exit(1);
});
