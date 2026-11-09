import pg from 'pg';
const { Pool } = pg;

const targetDb = process.argv[2] || process.env.TENANT_DB_NAME || 'fleetsphere_clientA';

const pool = new Pool({
  host: process.env.TENANT_DB_HOST || 'localhost',
  port: Number(process.env.TENANT_DB_PORT) || 5432,
  user: process.env.TENANT_DB_USER || 'postgres',
  password: process.env.TENANT_DB_PASSWORD || process.env.ADMIN_DB_PASSWORD || 'csq@123',
  database: targetDb,
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

  // Check sub_menu table
  if (tables.rows.some(r => r.table_name === 'tbl_sub_menu_mst')) {
    const cols = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tbl_sub_menu_mst';`);
    console.log('tbl_sub_menu_mst columns:', cols.rows);
    const subMenus = await pool.query(`SELECT * FROM tbl_sub_menu_mst;`);
    console.log('Submenus:', subMenus.rows);
  }

  await pool.end();
}

run().catch(console.error);
