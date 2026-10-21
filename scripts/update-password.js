import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function setPassword() {
  const email = process.argv[2] || 'admin@client001.com';
  const plainPassword = process.argv[3] || '1';
  const dbName = process.argv[4] || 'fleetsphere_clineta';
  const saltRounds = 10;

  console.log(`Hashing password for: ${email}`);
  console.log(`Plain Password: "${plainPassword}"`);
  console.log(`Target Database: "${dbName}"`);

  const hash = await bcrypt.hash(plainPassword, saltRounds);

  const pool = new Pool({
    host: process.env.ADMIN_DB_HOST || 'localhost',
    port: Number(process.env.ADMIN_DB_PORT) || 5432,
    user: process.env.ADMIN_DB_USER || 'postgres',
    password: process.env.ADMIN_DB_PASSWORD || 'athul@2004',
    database: dbName,
  });

  try {
    const updateRes = await pool.query(
      `UPDATE public.tbl_user_mst
       SET c_password_hash = $1,
           c_user_status = 'ACTIVE',
           b_is_active = TRUE
       WHERE LOWER(c_email) = LOWER($2)
       RETURNING u_user_id, c_email, c_user_status, b_is_active, c_password_hash;`,
      [hash, email]
    );

    if (updateRes.rows.length === 0) {
      console.warn(`[WARNING] No user found with email "${email}" in database "${dbName}".`);
    } else {
      console.log('\n[SUCCESS] Password updated successfully in tbl_user_mst:');
      console.log({
        email: updateRes.rows[0].c_email,
        status: updateRes.rows[0].c_user_status,
        isActive: updateRes.rows[0].b_is_active,
        passwordHash: updateRes.rows[0].c_password_hash,
      });

      const isValid = await bcrypt.compare(plainPassword, updateRes.rows[0].c_password_hash);
      console.log(`Verification: bcrypt.compare("${plainPassword}", hash) === ${isValid}`);
    }
  } catch (err) {
    console.error('[ERROR] Failed to update password:', err.message);
  } finally {
    await pool.end();
  }
}

setPassword();
