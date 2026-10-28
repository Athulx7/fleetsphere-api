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
  console.log('=== VERIFYING DYNAMIC MASTERS & MENU STRUCTURE ===\n');

  // 1. Verify dynamic masters
  const mastersRes = await pool.query(`
    SELECT master_id, master_code, header_name, table_name,
           (SELECT COUNT(*) FROM public.tbl_dynamicmaster_setup s WHERE s.master_id = h.master_id) as field_count
    FROM public.tbl_dynamicmaster_header h
    ORDER BY master_id;
  `);

  console.log(`Configured Dynamic Masters: ${mastersRes.rows.length}`);
  for (const m of mastersRes.rows) {
    console.log(`  • [${m.master_code}] ${m.header_name} (${m.table_name}) - ${m.field_count} fields`);
  }

  // 2. Verify Menu Headers & Sub-menus
  const query = `
    SELECT DISTINCT
      h.header_id,
      h.header_name,
      h.header_code,
      h.icon_name AS header_icon,
      h.display_order AS header_display_order,
      sm.sub_menu_id,
      sm.sub_menu_name,
      sm.route_path,
      sm.icon_name AS sub_icon,
      sm.display_order AS sub_display_order,
      COALESCE(sm.is_sidebar_visible, TRUE) AS is_sidebar_visible,
      COALESCE(sm.description, '') AS description
    FROM public.tbl_sub_menu_mst sm
    INNER JOIN public.tbl_menu_mst_header h ON sm.header_id = h.header_id
    LEFT JOIN public.tbl_role_menu_mapping rmm 
      ON sm.sub_menu_id = rmm.sub_menu_id 
      AND rmm.role_code = ANY($1::text[]) 
      AND rmm.can_view = TRUE 
      AND rmm.is_active = TRUE
    WHERE sm.is_active = TRUE 
      AND h.is_active = TRUE
      AND rmm.mapping_id IS NOT NULL
    ORDER BY h.display_order ASC, sm.display_order ASC;
  `;

  const menuRes = await pool.query(query, [['ADMIN']]);
  console.log(`\nTotal Active Sub-menus mapped to ADMIN: ${menuRes.rows.length}`);

  const byCat = {};
  const sidebarItems = [];

  for (const r of menuRes.rows) {
    byCat[r.header_name] = byCat[r.header_name] || [];
    byCat[r.header_name].push(r);
    if (r.is_sidebar_visible) {
      sidebarItems.push(r);
    }
  }

  for (const [cat, items] of Object.entries(byCat)) {
    console.log(`\n📂 Category: "${cat}" (${items.length} items):`);
    for (const item of items) {
      console.log(`    - ${item.sub_menu_name.padEnd(30)} ${item.route_path.padEnd(30)} [order: ${item.sub_display_order}, sidebar: ${item.is_sidebar_visible}]`);
    }
  }

  console.log(`\n📌 Default Visible Sidebar Items (${sidebarItems.length} items):`);
  for (const s of sidebarItems) {
    console.log(`    #${s.sub_display_order}: ${s.sub_menu_name} -> ${s.route_path}`);
  }

  // 3. Verify sample data in tables
  console.log('\n📊 Sample Data Count across Master Tables:');
  const tables = [
    'tbl_country_mst', 'tbl_state_mst', 'tbl_district_mst', 'tbl_city_mst',
    'tbl_zone_mst', 'tbl_region_mst', 'tbl_area_mst', 'tbl_sub_area_mst',
    'tbl_branch_mst', 'tbl_hub_mst', 'tbl_department_mst', 'tbl_designation_master',
    'tbl_employee_type_mst', 'tbl_employment_status_mst', 'tbl_org_level_mst',
    'tbl_org_unit_mst', 'tbl_reporting_structure_mst', 'tbl_shift_mst',
    'tbl_skill_mst', 'tbl_document_type_mst', 'tbl_employee_master'
  ];

  for (const tbl of tables) {
    const countRes = await pool.query(`SELECT COUNT(*) FROM public.${tbl}`);
    console.log(`  ✓ ${tbl.padEnd(32)}: ${countRes.rows[0].count} records`);
  }

  await pool.end();
}

verify().catch(console.error);

