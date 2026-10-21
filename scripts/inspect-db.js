import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'athul@2004',
  database: 'fleetsphere_clineta'
});

async function run() {
  const tables = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log('Tables:', tables.rows.map(r => r.table_name));

  // Check roles table structure if exists
  if (tables.rows.some(r => r.table_name === 'tbl_role_mst')) {
    const roles = await pool.query(`SELECT * FROM tbl_role_mst;`);
    console.log('Roles:', roles.rows);
  }

  // Check user table
  if (tables.rows.some(r => r.table_name === 'tbl_user_mst')) {
    const users = await pool.query(`SELECT u_user_id, c_email, c_user_status FROM tbl_user_mst LIMIT 5;`);
    console.log('Users:', users.rows);
  }

  // Check employee table
  if (tables.rows.some(r => r.table_name === 'tbl_employee_mst')) {
    const emps = await pool.query(`SELECT * FROM tbl_employee_mst LIMIT 5;`);
    console.log('Employees:', emps.rows);
  }

  await pool.end();
}

run().catch(console.error);
