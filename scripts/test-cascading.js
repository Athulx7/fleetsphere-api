import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'athul@2004',
  database: 'fleetsphere_clineta'
});

async function testDropdown() {
  const meta = await pool.query(`
    SELECT s.column_name, s.label, s.priority, s.depends_on, s.depends_on_field, s.dropdown_table, s.dropdown_value_field, s.dropdown_label_field
    FROM tbl_dynamicmaster_setup s
    JOIN tbl_dynamicmaster_header h ON s.master_id = h.master_id
    WHERE h.master_code = 'city'
    ORDER BY s.priority;
  `);
  console.log('City form fields order:');
  meta.rows.forEach(r => console.log(`  Priority ${r.priority}: ${r.column_name.padEnd(15)} (${r.label}) [depends_on=${r.depends_on || 'none'}]`));

  // Test district query for state_id = 1 (Kerala)
  const dKerala = await pool.query('SELECT id, district_name FROM tbl_district_mst WHERE state_id = $1 ORDER BY district_name', [1]);
  console.log('\nDistricts for Kerala (state_id = 1):', dKerala.rows.map(x => x.district_name));

  // Test district query for state_id = 2 (Tamil Nadu)
  const dTN = await pool.query('SELECT id, district_name FROM tbl_district_mst WHERE state_id = $1 ORDER BY district_name', [2]);
  console.log('Districts for Tamil Nadu (state_id = 2):', dTN.rows.map(x => x.district_name));

  // Test district query for state_id = 3 (Karnataka)
  const dKA = await pool.query('SELECT id, district_name FROM tbl_district_mst WHERE state_id = $1 ORDER BY district_name', [3]);
  console.log('Districts for Karnataka (state_id = 3):', dKA.rows.map(x => x.district_name));

  // Test branch cascades: state_id -> city_id, region_id -> area_id
  const branchMeta = await pool.query(`
    SELECT s.column_name, s.label, s.priority, s.depends_on, s.depends_on_field
    FROM tbl_dynamicmaster_setup s
    JOIN tbl_dynamicmaster_header h ON s.master_id = h.master_id
    WHERE h.master_code = 'branch'
    ORDER BY s.priority;
  `);
  console.log('\nBranch form fields order:');
  branchMeta.rows.forEach(r => console.log(`  Priority ${r.priority}: ${r.column_name.padEnd(15)} (${r.label}) [depends_on=${r.depends_on || 'none'}]`));

  await pool.end();
}

testDropdown().catch(console.error);

