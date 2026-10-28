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
  console.log('=== UPDATING CASCADING MASTERS CONFIGURATION & DATA ===\n');

  // 1. Seed Multi-State Districts & Cities for Realistic Cascading Filtering
  console.log('--- 1. Seeding Multi-State Districts & Cities ---');
  
  // States: 1: Kerala, 2: Tamil Nadu, 3: Karnataka, 4: Maharashtra
  await pool.query(`
    INSERT INTO public.tbl_district_mst (district_code, district_name, state_id)
    VALUES
      ('DST005', 'Chennai', 2),
      ('DST006', 'Coimbatore', 2),
      ('DST007', 'Madurai', 2),
      ('DST008', 'Bengaluru Urban', 3),
      ('DST009', 'Mysuru', 3),
      ('DST010', 'Dakshina Kannada', 3),
      ('DST011', 'Mumbai City', 4),
      ('DST012', 'Pune', 4),
      ('DST013', 'Nagpur', 4)
    ON CONFLICT (district_code) DO NOTHING;
  `);

  // Fetch district IDs
  const dRes = await pool.query(`SELECT id, district_name FROM public.tbl_district_mst;`);
  const dMap = {};
  for (const r of dRes.rows) {
    dMap[r.district_name] = r.id;
  }

  // Cities linked to respective states & districts
  await pool.query(`
    INSERT INTO public.tbl_city_mst (city_code, city_name, district_id, state_id, pin_code)
    VALUES
      ('CTY005', 'Chennai Central', $1, 2, '600001'),
      ('CTY006', 'Coimbatore City', $2, 2, '641001'),
      ('CTY007', 'Madurai Town', $3, 2, '625001'),
      ('CTY008', 'Bengaluru City', $4, 3, '560001'),
      ('CTY009', 'Mysuru Town', $5, 3, '570001'),
      ('CTY010', 'Mangaluru', $6, 3, '575001'),
      ('CTY011', 'Mumbai Fort', $7, 4, '400001'),
      ('CTY012', 'Pune Camp', $8, 4, '411001')
    ON CONFLICT (city_code) DO NOTHING;
  `, [
    dMap['Chennai'] || null,
    dMap['Coimbatore'] || null,
    dMap['Madurai'] || null,
    dMap['Bengaluru Urban'] || null,
    dMap['Mysuru'] || null,
    dMap['Dakshina Kannada'] || null,
    dMap['Mumbai City'] || null,
    dMap['Pune'] || null,
  ]);

  // Seed sample areas for other regions
  const blrCityRes = await pool.query(`SELECT id FROM public.tbl_city_mst WHERE city_name = 'Bengaluru City' LIMIT 1;`);
  const blrCityId = blrCityRes.rows[0]?.id || null;
  const kaRegRes = await pool.query(`SELECT id FROM public.tbl_region_mst WHERE region_name = 'Karnataka Region' LIMIT 1;`);
  const kaRegId = kaRegRes.rows[0]?.id || 3;

  await pool.query(`
    INSERT INTO public.tbl_area_mst (area_code, area_name, region_id, city_id, description)
    VALUES
      ('AR004', 'Electronic City Hub', $1, $2, 'Bengaluru South industrial logistics zone'),
      ('AR005', 'Whitefield Tech Corridor', $1, $2, 'East Bengaluru IT & distribution corridor')
    ON CONFLICT (area_code) DO NOTHING;
  `, [kaRegId, blrCityId]);

  console.log('✓ Multi-state sample records seeded.');

  // 2. Define All Dynamic Masters with Strict Priority Order & Cascading Dependencies
  console.log('\n--- 2. Updating Dynamic Master Setup with Cascading Dependencies ---');

  const masterConfigs = [
    // 1. Country Master
    {
      code: 'country',
      fields: [
        { col: 'country_code', label: 'Country Code', type: 'text', req: true, list: true, auto: true, pfx: 'CN', len: 3, pri: 1 },
        { col: 'country_name', label: 'Country Name', type: 'text', req: true, list: true, pri: 2 },
        { col: 'iso_code', label: 'ISO Code', type: 'text', req: false, list: true, pri: 3 },
        { col: 'phone_code', label: 'Dialing Code', type: 'text', req: false, list: true, pri: 4 },
        { col: 'currency_code', label: 'Currency', type: 'text', req: false, list: true, pri: 5 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 6 },
      ],
    },

    // 2. State Master (Country -> State)
    {
      code: 'state',
      fields: [
        { col: 'state_code', label: 'State Code', type: 'text', req: true, list: true, auto: true, pfx: 'ST', len: 3, pri: 1 },
        {
          col: 'country_id', label: 'Country', type: 'dropdown', req: true, list: true, pri: 2,
          table: 'tbl_country_mst', val: 'id', lbl: 'country_name',
        },
        { col: 'state_name', label: 'State Name', type: 'text', req: true, list: true, pri: 3 },
        { col: 'state_type', label: 'Type (State/UT)', type: 'text', req: false, list: true, pri: 4 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 5 },
      ],
    },

    // 3. District Master (State -> District)
    {
      code: 'district',
      fields: [
        { col: 'district_code', label: 'District Code', type: 'text', req: true, list: true, auto: true, pfx: 'DST', len: 3, pri: 1 },
        {
          col: 'state_id', label: 'State', type: 'dropdown', req: true, list: true, pri: 2,
          table: 'tbl_state_mst', val: 'id', lbl: 'state_name',
        },
        { col: 'district_name', label: 'District Name', type: 'text', req: true, list: true, pri: 3 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 4 },
      ],
    },

    // 4. City / Town Master (State -> District -> City)
    // Priority: State comes BEFORE District, District filters based on State!
    {
      code: 'city',
      fields: [
        { col: 'city_code', label: 'City Code', type: 'text', req: true, list: true, auto: true, pfx: 'CTY', len: 3, pri: 1 },
        { col: 'city_name', label: 'City / Town Name', type: 'text', req: true, list: true, pri: 2 },
        {
          col: 'state_id', label: 'State', type: 'dropdown', req: true, list: true, pri: 3,
          table: 'tbl_state_mst', val: 'id', lbl: 'state_name',
        },
        {
          col: 'district_id', label: 'District', type: 'dropdown', req: false, list: true, pri: 4,
          table: 'tbl_district_mst', val: 'id', lbl: 'district_name',
          dep: 'state_id', depField: 'state_id',
        },
        { col: 'pin_code', label: 'Postal / PIN Code', type: 'text', req: false, list: true, pri: 5 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 6 },
      ],
    },

    // 5. Zone Master
    {
      code: 'zone',
      fields: [
        { col: 'zone_code', label: 'Zone Code', type: 'text', req: true, list: true, auto: true, pfx: 'ZN', len: 3, pri: 1 },
        { col: 'zone_name', label: 'Zone Name', type: 'text', req: true, list: true, pri: 2 },
        { col: 'description', label: 'Description', type: 'textarea', req: false, list: true, pri: 3 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 4 },
      ],
    },

    // 6. Region Master (Zone -> Region)
    {
      code: 'region',
      fields: [
        { col: 'region_code', label: 'Region Code', type: 'text', req: true, list: true, auto: true, pfx: 'REG', len: 3, pri: 1 },
        {
          col: 'zone_id', label: 'Operating Zone', type: 'dropdown', req: false, list: true, pri: 2,
          table: 'tbl_zone_mst', val: 'id', lbl: 'zone_name',
        },
        { col: 'region_name', label: 'Region Name', type: 'text', req: true, list: true, pri: 3 },
        { col: 'description', label: 'Description', type: 'textarea', req: false, list: true, pri: 4 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 5 },
      ],
    },

    // 7. Area Master (Region -> Area)
    {
      code: 'area',
      fields: [
        { col: 'area_code', label: 'Area Code', type: 'text', req: true, list: true, auto: true, pfx: 'AR', len: 3, pri: 1 },
        { col: 'area_name', label: 'Area Name', type: 'text', req: true, list: true, pri: 2 },
        {
          col: 'region_id', label: 'Operating Region', type: 'dropdown', req: false, list: true, pri: 3,
          table: 'tbl_region_mst', val: 'id', lbl: 'region_name',
        },
        {
          col: 'city_id', label: 'City / Town', type: 'dropdown', req: false, list: true, pri: 4,
          table: 'tbl_city_mst', val: 'id', lbl: 'city_name',
        },
        { col: 'description', label: 'Description', type: 'textarea', req: false, list: true, pri: 5 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 6 },
      ],
    },

    // 8. Sub-Area Master (Area -> Sub-Area)
    {
      code: 'sub-area',
      fields: [
        { col: 'sub_area_code', label: 'Sub-Area Code', type: 'text', req: true, list: true, auto: true, pfx: 'SAR', len: 3, pri: 1 },
        {
          col: 'area_id', label: 'Operating Area', type: 'dropdown', req: true, list: true, pri: 2,
          table: 'tbl_area_mst', val: 'id', lbl: 'area_name',
        },
        { col: 'sub_area_name', label: 'Sub-Area Name', type: 'text', req: true, list: true, pri: 3 },
        { col: 'description', label: 'Description', type: 'textarea', req: false, list: true, pri: 4 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 5 },
      ],
    },

    // 9. Branch / Depot Master
    // Cascades:
    //  State -> City (City filtered by state_id)
    //  Region -> Area (Area filtered by region_id)
    {
      code: 'branch',
      fields: [
        { col: 'branch_code', label: 'Branch Code', type: 'text', req: true, list: true, auto: true, pfx: 'BR', len: 3, pri: 1 },
        { col: 'branch_name', label: 'Branch / Depot Name', type: 'text', req: true, list: true, pri: 2 },
        { col: 'branch_type', label: 'Facility Type', type: 'text', req: false, list: true, pri: 3 },
        {
          col: 'state_id', label: 'State', type: 'dropdown', req: false, list: true, pri: 4,
          table: 'tbl_state_mst', val: 'id', lbl: 'state_name',
        },
        {
          col: 'city_id', label: 'City', type: 'dropdown', req: false, list: true, pri: 5,
          table: 'tbl_city_mst', val: 'id', lbl: 'city_name',
          dep: 'state_id', depField: 'state_id',
        },
        {
          col: 'region_id', label: 'Region', type: 'dropdown', req: false, list: true, pri: 6,
          table: 'tbl_region_mst', val: 'id', lbl: 'region_name',
        },
        {
          col: 'area_id', label: 'Area', type: 'dropdown', req: false, list: true, pri: 7,
          table: 'tbl_area_mst', val: 'id', lbl: 'area_name',
          dep: 'region_id', depField: 'region_id',
        },
        { col: 'contact_person', label: 'Contact Person', type: 'text', req: false, list: true, pri: 8 },
        { col: 'contact_number', label: 'Contact Number', type: 'text', req: false, list: true, pri: 9 },
        { col: 'address', label: 'Address', type: 'textarea', req: false, list: false, pri: 10 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 11 },
      ],
    },

    // 10. Warehouse / Hub Master (City -> Area)
    {
      code: 'hub',
      fields: [
        { col: 'hub_code', label: 'Hub Code', type: 'text', req: true, list: true, auto: true, pfx: 'HUB', len: 3, pri: 1 },
        { col: 'hub_name', label: 'Warehouse / Hub Name', type: 'text', req: true, list: true, pri: 2 },
        { col: 'hub_type', label: 'Facility Type', type: 'text', req: false, list: true, pri: 3 },
        {
          col: 'branch_id', label: 'Supervising Branch', type: 'dropdown', req: false, list: true, pri: 4,
          table: 'tbl_branch_mst', val: 'id', lbl: 'branch_name',
        },
        {
          col: 'city_id', label: 'City', type: 'dropdown', req: false, list: true, pri: 5,
          table: 'tbl_city_mst', val: 'id', lbl: 'city_name',
        },
        {
          col: 'area_id', label: 'Area', type: 'dropdown', req: false, list: true, pri: 6,
          table: 'tbl_area_mst', val: 'id', lbl: 'area_name',
          dep: 'city_id', depField: 'city_id',
        },
        { col: 'storage_capacity', label: 'Storage Capacity', type: 'text', req: false, list: true, pri: 7 },
        { col: 'address', label: 'Address', type: 'textarea', req: false, list: false, pri: 8 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 9 },
      ],
    },

    // 11. Department
    {
      code: 'department',
      fields: [
        { col: 'dept_code', label: 'Department Code', type: 'text', req: true, list: true, auto: true, pfx: 'DEP', len: 3, pri: 1 },
        { col: 'dept_name', label: 'Department Name', type: 'text', req: true, list: true, pri: 2 },
        { col: 'description', label: 'Description', type: 'textarea', req: false, list: true, pri: 3 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 4 },
      ],
    },

    // 12. Designation
    {
      code: 'designation',
      fields: [
        { col: 'designation_code', label: 'Designation Code', type: 'text', req: true, list: true, auto: true, pfx: 'DES', len: 3, pri: 1 },
        { col: 'designation_name', label: 'Designation Name', type: 'text', req: true, list: true, pri: 2 },
        { col: 'description', label: 'Role Description', type: 'textarea', req: false, list: true, pri: 3 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 4 },
      ],
    },

    // 13. Employee Type
    {
      code: 'employee-type',
      fields: [
        { col: 'type_code', label: 'Type Code', type: 'text', req: true, list: true, auto: true, pfx: 'TYP', len: 3, pri: 1 },
        { col: 'type_name', label: 'Employee Type Name', type: 'text', req: true, list: true, pri: 2 },
        { col: 'description', label: 'Description', type: 'textarea', req: false, list: true, pri: 3 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 4 },
      ],
    },

    // 14. Employment Status
    {
      code: 'employment-status',
      fields: [
        { col: 'status_code', label: 'Status Code', type: 'text', req: true, list: true, auto: true, pfx: 'STA', len: 3, pri: 1 },
        { col: 'status_name', label: 'Status Name', type: 'text', req: true, list: true, pri: 2 },
        { col: 'is_terminal', label: 'Terminal State (Resigned/Terminated)', type: 'toggle', req: false, list: true, pri: 3 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 4 },
      ],
    },

    // 15. Org Level
    {
      code: 'org-level',
      fields: [
        { col: 'level_code', label: 'Level Code', type: 'text', req: true, list: true, auto: true, pfx: 'LVL', len: 3, pri: 1 },
        { col: 'level_name', label: 'Level Name', type: 'text', req: true, list: true, pri: 2 },
        { col: 'hierarchy_rank', label: 'Hierarchy Rank', type: 'number', req: true, list: true, pri: 3 },
        { col: 'description', label: 'Description', type: 'textarea', req: false, list: true, pri: 4 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 5 },
      ],
    },

    // 16. Org Unit
    {
      code: 'org-unit',
      fields: [
        { col: 'unit_code', label: 'Unit Code', type: 'text', req: true, list: true, auto: true, pfx: 'UNT', len: 3, pri: 1 },
        { col: 'unit_name', label: 'Unit Name', type: 'text', req: true, list: true, pri: 2 },
        {
          col: 'org_level_id', label: 'Organization Level', type: 'dropdown', req: true, list: true, pri: 3,
          table: 'tbl_org_level_mst', val: 'id', lbl: 'level_name',
        },
        {
          col: 'parent_unit_id', label: 'Parent Organization Unit', type: 'dropdown', req: false, list: true, pri: 4,
          table: 'tbl_org_unit_mst', val: 'id', lbl: 'unit_name',
        },
        { col: 'description', label: 'Description', type: 'textarea', req: false, list: true, pri: 5 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 6 },
      ],
    },

    // 17. Reporting Structure
    {
      code: 'reporting-structure',
      fields: [
        { col: 'structure_code', label: 'Structure Code', type: 'text', req: true, list: true, auto: true, pfx: 'REP', len: 3, pri: 1 },
        {
          col: 'department_id', label: 'Department', type: 'dropdown', req: false, list: true, pri: 2,
          table: 'tbl_department_mst', val: 'id', lbl: 'dept_name',
        },
        {
          col: 'designation_id', label: 'Employee Designation', type: 'dropdown', req: true, list: true, pri: 3,
          table: 'tbl_designation_master', val: 'id', lbl: 'designation_name',
        },
        {
          col: 'reports_to_designation_id', label: 'Reports To (Manager Designation)', type: 'dropdown', req: true, list: true, pri: 4,
          table: 'tbl_designation_master', val: 'id', lbl: 'designation_name',
        },
        { col: 'notes', label: 'Relationship Notes', type: 'textarea', req: false, list: true, pri: 5 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 6 },
      ],
    },

    // 18. Shift Master
    {
      code: 'shift',
      fields: [
        { col: 'shift_code', label: 'Shift Code', type: 'text', req: true, list: true, auto: true, pfx: 'SHF', len: 3, pri: 1 },
        { col: 'shift_name', label: 'Shift Name', type: 'text', req: true, list: true, pri: 2 },
        { col: 'start_time', label: 'Shift Start Time', type: 'text', req: true, list: true, pri: 3 },
        { col: 'end_time', label: 'Shift End Time', type: 'text', req: true, list: true, pri: 4 },
        { col: 'description', label: 'Description', type: 'textarea', req: false, list: true, pri: 5 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 6 },
      ],
    },

    // 19. Skill Master
    {
      code: 'skill',
      fields: [
        { col: 'skill_code', label: 'Skill Code', type: 'text', req: true, list: true, auto: true, pfx: 'SKL', len: 3, pri: 1 },
        { col: 'skill_name', label: 'Skill / Certification Name', type: 'text', req: true, list: true, pri: 2 },
        { col: 'validity_years', label: 'Validity (Years)', type: 'number', req: false, list: true, pri: 3 },
        { col: 'description', label: 'Description', type: 'textarea', req: false, list: true, pri: 4 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 5 },
      ],
    },

    // 20. Document Type
    {
      code: 'document-type',
      fields: [
        { col: 'doc_type_code', label: 'Type Code', type: 'text', req: true, list: true, auto: true, pfx: 'DOC', len: 3, pri: 1 },
        { col: 'doc_type_name', label: 'Document Name', type: 'text', req: true, list: true, pri: 2 },
        { col: 'is_mandatory', label: 'Mandatory Document', type: 'toggle', req: false, list: true, pri: 3 },
        { col: 'description', label: 'Description', type: 'textarea', req: false, list: true, pri: 4 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 5 },
      ],
    },

    // 21. Employee Master (Region -> Area cascading)
    {
      code: 'employee-master',
      fields: [
        { col: 'employee_code', label: 'Employee Code', type: 'text', req: true, list: true, auto: true, pfx: 'EMP', len: 3, pri: 1 },
        { col: 'first_name', label: 'First Name', type: 'text', req: true, list: true, pri: 2 },
        { col: 'last_name', label: 'Last Name', type: 'text', req: false, list: true, pri: 3 },
        { col: 'email', label: 'Email Address', type: 'text', req: false, list: true, pri: 4 },
        { col: 'phone_number', label: 'Contact Phone', type: 'text', req: false, list: true, pri: 5 },
        {
          col: 'department_id', label: 'Department', type: 'dropdown', req: false, list: true, pri: 6,
          table: 'tbl_department_mst', val: 'id', lbl: 'dept_name',
        },
        {
          col: 'designation_id', label: 'Designation / Role', type: 'dropdown', req: true, list: true, pri: 7,
          table: 'tbl_designation_master', val: 'id', lbl: 'designation_name',
        },
        {
          col: 'employee_type_id', label: 'Employment Type', type: 'dropdown', req: false, list: true, pri: 8,
          table: 'tbl_employee_type_mst', val: 'id', lbl: 'type_name',
        },
        {
          col: 'employment_status_id', label: 'Status', type: 'dropdown', req: false, list: true, pri: 9,
          table: 'tbl_employment_status_mst', val: 'id', lbl: 'status_name',
        },
        {
          col: 'branch_id', label: 'Assigned Branch / Depot', type: 'dropdown', req: false, list: true, pri: 10,
          table: 'tbl_branch_mst', val: 'id', lbl: 'branch_name',
        },
        {
          col: 'manager_id', label: 'Reporting Manager', type: 'dropdown', req: false, list: true, pri: 11,
          table: 'tbl_employee_master', val: 'id', lbl: 'first_name',
        },
        {
          col: 'region_id', label: 'Assigned Region', type: 'dropdown', req: false, list: false, pri: 12,
          table: 'tbl_region_mst', val: 'id', lbl: 'region_name',
        },
        {
          col: 'area_id', label: 'Assigned Area', type: 'dropdown', req: false, list: false, pri: 13,
          table: 'tbl_area_mst', val: 'id', lbl: 'area_name',
          dep: 'region_id', depField: 'region_id',
        },
        {
          col: 'shift_id', label: 'Work Shift', type: 'dropdown', req: false, list: true, pri: 14,
          table: 'tbl_shift_mst', val: 'id', lbl: 'shift_name',
        },
        { col: 'joining_date', label: 'Joining Date', type: 'date', req: false, list: true, pri: 15 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 16 },
      ],
    },
  ];

  for (const mc of masterConfigs) {
    const headRes = await pool.query(
      `SELECT master_id FROM public.tbl_dynamicmaster_header WHERE master_code = $1;`,
      [mc.code]
    );

    if (headRes.rows.length === 0) {
      console.warn(`! Master not found: ${mc.code}`);
      continue;
    }

    const masterId = headRes.rows[0].master_id;

    // Delete existing setup fields
    await pool.query(`DELETE FROM public.tbl_dynamicmaster_setup WHERE master_id = $1;`, [masterId]);

    // Insert new setup fields with depends_on and depends_on_field
    for (const f of mc.fields) {
      await pool.query(`
        INSERT INTO public.tbl_dynamicmaster_setup 
          (master_id, column_name, label, field_type, priority, visible, required, readonly,
           dropdown_source, dropdown_table, dropdown_value_field, dropdown_label_field,
           depends_on, depends_on_field,
           show_in_list, list_label, is_auto_code, code_prefix, code_length, is_disable)
        VALUES
          ($1, $2, $3, $4, $5, true, $6, false,
           $7, $8, $9, $10,
           $11, $12,
           $13, $14, $15, $16, $17, false);
      `, [
        masterId,
        f.col,
        f.label,
        f.type,
        f.pri,
        Boolean(f.req),
        f.table || null,
        f.table || null,
        f.val || null,
        f.lbl || null,
        f.dep || null,
        f.depField || null,
        Boolean(f.list),
        f.label,
        Boolean(f.auto),
        f.pfx || null,
        f.len || 3,
      ]);
    }

    const depFields = mc.fields.filter(f => f.dep).map(f => `${f.col} -> depends on ${f.dep}`).join(', ');
    console.log(`✓ Updated [${mc.code}] (${mc.fields.length} fields)${depFields ? ` | Cascades: [${depFields}]` : ''}`);
  }

  console.log('\n=== CASCADING MASTERS CONFIGURATION COMPLETED SUCCESSFULLY ===');
  await pool.end();
}

main().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});

