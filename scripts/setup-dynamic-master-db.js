import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'athul@2004',
  database: 'fleetsphere_clineta',
});

async function migrate() {
  console.log('Running Dynamic Master migrations on fleetsphere_clineta...');

  // 1. Ensure tbl_dynamicmaster_header exists and has primary key sequence
  await pool.query(`
    CREATE SEQUENCE IF NOT EXISTS dynamicmaster_header_seq;
    
    CREATE TABLE IF NOT EXISTS public.tbl_dynamicmaster_header (
      master_id       INTEGER PRIMARY KEY DEFAULT nextval('dynamicmaster_header_seq'),
      menu_id         INTEGER,
      master_code     VARCHAR(50) NOT NULL UNIQUE,
      table_name      VARCHAR(100) NOT NULL,
      primary_key     VARCHAR(50) DEFAULT 'id',
      header_name     VARCHAR(100) NOT NULL,
      list_title      VARCHAR(100) NOT NULL,
      description     TEXT,
      is_active       BOOLEAN DEFAULT TRUE,
      created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // Ensure sequence ownership if table existed
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tbl_dynamicmaster_header_pkey') THEN
        ALTER TABLE public.tbl_dynamicmaster_header ADD PRIMARY KEY (master_id);
      END IF;
    END $$;
  `);

  // 2. Create tbl_dynamicmaster_setup
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_dynamicmaster_setup (
      id                   SERIAL PRIMARY KEY,
      master_id            INTEGER NOT NULL REFERENCES public.tbl_dynamicmaster_header(master_id) ON DELETE CASCADE,
      column_name          VARCHAR(100) NOT NULL,
      label                VARCHAR(100) NOT NULL,
      field_type           VARCHAR(50) NOT NULL,
      priority             INTEGER DEFAULT 1,
      visible              BOOLEAN DEFAULT TRUE,
      required             BOOLEAN DEFAULT FALSE,
      readonly             BOOLEAN DEFAULT FALSE,
      dropdown_source      VARCHAR(100),
      dropdown_table       VARCHAR(100),
      dropdown_value_field VARCHAR(100),
      dropdown_label_field VARCHAR(100),
      dropdown_filter      TEXT,
      depends_on           VARCHAR(100),
      depends_on_field     VARCHAR(100),
      regex                VARCHAR(255),
      max_length           INTEGER,
      min_length           INTEGER,
      show_in_list         BOOLEAN DEFAULT TRUE,
      list_label           VARCHAR(100),
      is_auto_code         BOOLEAN DEFAULT FALSE,
      code_prefix          VARCHAR(20),
      code_length          INTEGER DEFAULT 3,
      is_disable           BOOLEAN DEFAULT FALSE,
      list_join_query      TEXT,
      inline_master_code   VARCHAR(100),
      show_in_inline       BOOLEAN DEFAULT FALSE,
      created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // 3. Create physical master table tbl_hierarchy_mst
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_hierarchy_mst (
      id              SERIAL PRIMARY KEY,
      hierarchy_code  VARCHAR(50) NOT NULL UNIQUE,
      hierarchy_name  VARCHAR(150) NOT NULL,
      level_no        INTEGER NOT NULL,
      parent_id       INTEGER REFERENCES public.tbl_hierarchy_mst(id) ON DELETE SET NULL,
      is_active       BOOLEAN DEFAULT TRUE,
      created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // 4. Seed Header for 'hierarchy'
  const headerRes = await pool.query(`
    INSERT INTO public.tbl_dynamicmaster_header 
      (master_code, menu_id, table_name, primary_key, header_name, list_title, description, is_active)
    VALUES 
      ('hierarchy', 101, 'tbl_hierarchy_mst', 'id', 'Hierarchy Master', 'Hierarchy Master List', 'Organizational Hierarchy Structure Master', true)
    ON CONFLICT (master_code) 
    DO UPDATE SET 
      table_name = EXCLUDED.table_name,
      header_name = EXCLUDED.header_name,
      list_title = EXCLUDED.list_title
    RETURNING master_id;
  `);

  const masterId = headerRes.rows[0].master_id;
  console.log(`Hierarchy Master ID: ${masterId}`);

  // 5. Seed Setup Fields for 'hierarchy'
  await pool.query(`DELETE FROM public.tbl_dynamicmaster_setup WHERE master_id = $1;`, [masterId]);

  await pool.query(`
    INSERT INTO public.tbl_dynamicmaster_setup 
      (master_id, column_name, label, field_type, priority, visible, required, readonly, dropdown_source, dropdown_table, dropdown_value_field, dropdown_label_field, dropdown_filter, regex, max_length, show_in_list, list_label, is_auto_code, code_prefix, code_length, is_disable)
    VALUES
      ($1, 'hierarchy_code', 'Hierarchy Code', 'text', 1, true, true, false, NULL, NULL, NULL, NULL, NULL, NULL, 50, true, 'Hierarchy Code', true, 'H', 3, false),
      ($1, 'hierarchy_name', 'Hierarchy Name', 'text', 2, true, true, false, NULL, NULL, NULL, NULL, NULL, NULL, 150, true, 'Hierarchy Name', false, NULL, NULL, false),
      ($1, 'level_no', 'Level No', 'number', 3, true, true, false, NULL, NULL, NULL, NULL, NULL, '^\\d+$', NULL, true, 'Level No', false, NULL, NULL, false),
      ($1, 'parent_id', 'Parent Hierarchy', 'dropdown', 4, true, false, false, 'tbl_hierarchy_mst', 'tbl_hierarchy_mst', 'id', 'hierarchy_name', 'is_active = true', NULL, NULL, true, 'Parent Hierarchy', false, NULL, NULL, false),
      ($1, 'is_active', 'Active', 'toggle', 5, true, false, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, true, 'Status', false, NULL, NULL, false);
  `, [masterId]);

  // 6. Seed sample data in tbl_hierarchy_mst if empty
  const countRes = await pool.query(`SELECT COUNT(*) FROM public.tbl_hierarchy_mst;`);
  if (parseInt(countRes.rows[0].count, 10) === 0) {
    await pool.query(`
      INSERT INTO public.tbl_hierarchy_mst (hierarchy_code, hierarchy_name, level_no, parent_id, is_active)
      VALUES 
        ('H001', 'Corporate Headquarters', 1, NULL, true),
        ('H002', 'North Logistics Hub', 2, 1, true),
        ('H003', 'South Fleet Center', 2, 1, true);
    `);
    console.log('Inserted sample hierarchy records (H001, H002, H003).');
  }

  console.log('Dynamic Master DB setup completed successfully!');
  await pool.end();
}

migrate().catch(e => {
  console.error('Migration error:', e);
  process.exit(1);
});
