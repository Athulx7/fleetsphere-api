import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'athul@2004',
  database: 'fleetsphere_clineta'
});

async function inspect() {
  const tables = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log('Tables in fleetsphere_clineta:');
  console.log(tables.rows.map(r => r.table_name));

  // Check if any user-related table exists
  const userTables = tables.rows.filter(r => r.table_name.includes('user'));
  console.log('\nUser-related tables:', userTables.map(r => r.table_name));

  for (const t of userTables) {
    const cols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1;
    `, [t.table_name]);
    console.log(`\nColumns in ${t.table_name}:`, cols.rows.map(c => `${c.column_name} (${c.data_type})`));
  }

  // Check tbl_employee_master columns
  const empCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'tbl_employee_master';
  `);
  console.log('\nColumns in tbl_employee_master:', empCols.rows.map(c => `${c.column_name} (${c.data_type})`));

  await pool.end();
}

inspect().catch(console.error);

