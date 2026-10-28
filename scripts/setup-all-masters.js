import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'athul@2004',
  database: 'fleetsphere_clineta',
});

async function setup() {
  console.log('=== STARTING COMPLETE MASTERS DATABASE CONFIGURATION ===\n');

  // ==========================================================================
  // SECTION 1: PHYSICAL MASTER TABLES CREATION
  // ==========================================================================
  console.log('--- 1. Creating Physical Database Tables ---');

  // 1. Country Master
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_country_mst (
      id              SERIAL PRIMARY KEY,
      country_code    VARCHAR(20) NOT NULL UNIQUE,
      country_name    VARCHAR(150) NOT NULL UNIQUE,
      iso_code        VARCHAR(10),
      phone_code      VARCHAR(10),
      currency_code   VARCHAR(10),
      is_active       BOOLEAN DEFAULT TRUE,
      created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // 2. State Master
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_state_mst (
      id              SERIAL PRIMARY KEY,
      state_code      VARCHAR(20) NOT NULL UNIQUE,
      state_name      VARCHAR(150) NOT NULL,
      country_id      INTEGER NOT NULL REFERENCES public.tbl_country_mst(id) ON DELETE CASCADE,
      is_active       BOOLEAN DEFAULT TRUE,
      created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      CONSTRAINT uq_state_country UNIQUE (country_id, state_name)
    );
  `);

  // 3. District Master
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_district_mst (
      id              SERIAL PRIMARY KEY,
      district_code   VARCHAR(20) NOT NULL UNIQUE,
      district_name   VARCHAR(150) NOT NULL,
      state_id        INTEGER NOT NULL REFERENCES public.tbl_state_mst(id) ON DELETE CASCADE,
      is_active       BOOLEAN DEFAULT TRUE,
      created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      CONSTRAINT uq_district_state UNIQUE (state_id, district_name)
    );
  `);

  // 4. City / Town Master
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_city_mst (
      id              SERIAL PRIMARY KEY,
      city_code       VARCHAR(20) NOT NULL UNIQUE,
      city_name       VARCHAR(150) NOT NULL,
      district_id     INTEGER REFERENCES public.tbl_district_mst(id) ON DELETE SET NULL,
      state_id        INTEGER REFERENCES public.tbl_state_mst(id) ON DELETE SET NULL,
      pin_code        VARCHAR(20),
      is_active       BOOLEAN DEFAULT TRUE,
      created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // 5. Zone Master
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_zone_mst (
      id              SERIAL PRIMARY KEY,
      zone_code       VARCHAR(20) NOT NULL UNIQUE,
      zone_name       VARCHAR(150) NOT NULL UNIQUE,
      description     TEXT,
      is_active       BOOLEAN DEFAULT TRUE,
      created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // 6. Region Master (flexible link to Zone)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_region_mst (
      id              SERIAL PRIMARY KEY,
      region_code     VARCHAR(20) NOT NULL UNIQUE,
      region_name     VARCHAR(150) NOT NULL,
      zone_id         INTEGER REFERENCES public.tbl_zone_mst(id) ON DELETE SET NULL,
      description     TEXT,
      is_active       BOOLEAN DEFAULT TRUE,
      created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // 7. Area Master (flexible link to Region or City)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_area_mst (
      id              SERIAL PRIMARY KEY,
      area_code       VARCHAR(20) NOT NULL UNIQUE,
      area_name       VARCHAR(150) NOT NULL,
      region_id       INTEGER REFERENCES public.tbl_region_mst(id) ON DELETE SET NULL,
      city_id         INTEGER REFERENCES public.tbl_city_mst(id) ON DELETE SET NULL,
      description     TEXT,
      is_active       BOOLEAN DEFAULT TRUE,
      created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // 8. Sub-Area Master
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_sub_area_mst (
      id              SERIAL PRIMARY KEY,
      sub_area_code   VARCHAR(20) NOT NULL UNIQUE,
      sub_area_name   VARCHAR(150) NOT NULL,
      area_id         INTEGER NOT NULL REFERENCES public.tbl_area_mst(id) ON DELETE CASCADE,
      description     TEXT,
      is_active       BOOLEAN DEFAULT TRUE,
      created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // 9. Branch / Depot Master
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_branch_mst (
      id              SERIAL PRIMARY KEY,
      branch_code     VARCHAR(20) NOT NULL UNIQUE,
      branch_name     VARCHAR(150) NOT NULL,
      branch_type     VARCHAR(50) DEFAULT 'Branch',
      city_id         INTEGER REFERENCES public.tbl_city_mst(id) ON DELETE SET NULL,
      state_id        INTEGER REFERENCES public.tbl_state_mst(id) ON DELETE SET NULL,
      area_id         INTEGER REFERENCES public.tbl_area_mst(id) ON DELETE SET NULL,
      region_id       INTEGER REFERENCES public.tbl_region_mst(id) ON DELETE SET NULL,
      address         TEXT,
      contact_person  VARCHAR(100),
      contact_number  VARCHAR(30),
      is_active       BOOLEAN DEFAULT TRUE,
      created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // 10. Warehouse / Hub Master
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_hub_mst (
      id                SERIAL PRIMARY KEY,
      hub_code          VARCHAR(20) NOT NULL UNIQUE,
      hub_name          VARCHAR(150) NOT NULL,
      hub_type          VARCHAR(50) DEFAULT 'Warehouse',
      branch_id         INTEGER REFERENCES public.tbl_branch_mst(id) ON DELETE SET NULL,
      city_id           INTEGER REFERENCES public.tbl_city_mst(id) ON DELETE SET NULL,
      area_id           INTEGER REFERENCES public.tbl_area_mst(id) ON DELETE SET NULL,
      storage_capacity  VARCHAR(100),
      address           TEXT,
      is_active         BOOLEAN DEFAULT TRUE,
      created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // 11. Department Master
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_department_mst (
      id              SERIAL PRIMARY KEY,
      dept_code       VARCHAR(20) NOT NULL UNIQUE,
      dept_name       VARCHAR(150) NOT NULL UNIQUE,
      description     TEXT,
      is_active       BOOLEAN DEFAULT TRUE,
      created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // 12. Designation Master (dynamic master compatible)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_designation_master (
      id                SERIAL PRIMARY KEY,
      designation_code  VARCHAR(20) NOT NULL UNIQUE,
      designation_name  VARCHAR(150) NOT NULL,
      description       TEXT,
      is_active         BOOLEAN DEFAULT TRUE,
      created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // 13. Employee Type Master
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_employee_type_mst (
      id              SERIAL PRIMARY KEY,
      type_code       VARCHAR(20) NOT NULL UNIQUE,
      type_name       VARCHAR(100) NOT NULL UNIQUE,
      description     TEXT,
      is_active       BOOLEAN DEFAULT TRUE,
      created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // 14. Employment Status Master
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_employment_status_mst (
      id              SERIAL PRIMARY KEY,
      status_code     VARCHAR(20) NOT NULL UNIQUE,
      status_name     VARCHAR(100) NOT NULL UNIQUE,
      description     TEXT,
      is_active       BOOLEAN DEFAULT TRUE,
      created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // 15. Organization Level Master
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_org_level_mst (
      id                SERIAL PRIMARY KEY,
      level_code        VARCHAR(20) NOT NULL UNIQUE,
      level_name        VARCHAR(100) NOT NULL UNIQUE,
      hierarchy_order   INTEGER DEFAULT 1,
      description       TEXT,
      is_active         BOOLEAN DEFAULT TRUE,
      created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // 16. Organization Unit Master
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_org_unit_mst (
      id              SERIAL PRIMARY KEY,
      unit_code       VARCHAR(20) NOT NULL UNIQUE,
      unit_name       VARCHAR(150) NOT NULL,
      org_level_id    INTEGER REFERENCES public.tbl_org_level_mst(id) ON DELETE SET NULL,
      parent_unit_id  INTEGER REFERENCES public.tbl_org_unit_mst(id) ON DELETE SET NULL,
      description     TEXT,
      is_active       BOOLEAN DEFAULT TRUE,
      created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // 17. Reporting Structure Master
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_reporting_structure_mst (
      id                        SERIAL PRIMARY KEY,
      structure_code            VARCHAR(20) NOT NULL UNIQUE,
      designation_id            INTEGER REFERENCES public.tbl_designation_master(id) ON DELETE CASCADE,
      reports_to_designation_id INTEGER REFERENCES public.tbl_designation_master(id) ON DELETE CASCADE,
      department_id             INTEGER REFERENCES public.tbl_department_mst(id) ON DELETE SET NULL,
      notes                     TEXT,
      is_active                 BOOLEAN DEFAULT TRUE,
      created_at                TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at                TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // 18. Shift Master
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_shift_mst (
      id              SERIAL PRIMARY KEY,
      shift_code      VARCHAR(20) NOT NULL UNIQUE,
      shift_name      VARCHAR(100) NOT NULL,
      start_time      VARCHAR(10) NOT NULL,
      end_time        VARCHAR(10) NOT NULL,
      description     TEXT,
      is_active       BOOLEAN DEFAULT TRUE,
      created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // 19. Skill / Certification Master
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_skill_mst (
      id              SERIAL PRIMARY KEY,
      skill_code      VARCHAR(20) NOT NULL UNIQUE,
      skill_name      VARCHAR(150) NOT NULL,
      validity_years  INTEGER DEFAULT 1,
      description     TEXT,
      is_active       BOOLEAN DEFAULT TRUE,
      created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // 20. Document Type Master
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_document_type_mst (
      id              SERIAL PRIMARY KEY,
      doc_type_code   VARCHAR(20) NOT NULL UNIQUE,
      doc_type_name   VARCHAR(150) NOT NULL,
      is_mandatory    BOOLEAN DEFAULT FALSE,
      description     TEXT,
      is_active       BOOLEAN DEFAULT TRUE,
      created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // 21. Employee Master (Comprehensive entity referencing enterprise masters)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.tbl_employee_master (
      id                    SERIAL PRIMARY KEY,
      employee_code         VARCHAR(50) NOT NULL UNIQUE,
      first_name            VARCHAR(100) NOT NULL,
      last_name             VARCHAR(100),
      email                 VARCHAR(150),
      phone_number          VARCHAR(30),
      joining_date          DATE,
      designation_id        INTEGER REFERENCES public.tbl_designation_master(id) ON DELETE SET NULL,
      department_id         INTEGER REFERENCES public.tbl_department_mst(id) ON DELETE SET NULL,
      employee_type_id      INTEGER REFERENCES public.tbl_employee_type_mst(id) ON DELETE SET NULL,
      employment_status_id  INTEGER REFERENCES public.tbl_employment_status_mst(id) ON DELETE SET NULL,
      branch_id             INTEGER REFERENCES public.tbl_branch_mst(id) ON DELETE SET NULL,
      manager_id            INTEGER REFERENCES public.tbl_employee_master(id) ON DELETE SET NULL,
      region_id             INTEGER REFERENCES public.tbl_region_mst(id) ON DELETE SET NULL,
      area_id               INTEGER REFERENCES public.tbl_area_mst(id) ON DELETE SET NULL,
      shift_id              INTEGER REFERENCES public.tbl_shift_mst(id) ON DELETE SET NULL,
      is_active             BOOLEAN DEFAULT TRUE,
      created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  console.log('✓ All 21 physical master tables confirmed.');

  // ==========================================================================
  // SECTION 2: SEED INITIAL SAMPLE DATA
  // ==========================================================================
  console.log('\n--- 2. Seeding Sample Master Records ---');

  // Country
  await pool.query(`
    INSERT INTO public.tbl_country_mst (country_code, country_name, iso_code, phone_code, currency_code)
    VALUES 
      ('CN001', 'India', 'IN', '+91', 'INR'),
      ('CN002', 'United States', 'US', '+1', 'USD'),
      ('CN003', 'United Arab Emirates', 'AE', '+971', 'AED')
    ON CONFLICT (country_code) DO NOTHING;
  `);

  // State
  const inRes = await pool.query(`SELECT id FROM public.tbl_country_mst WHERE country_name = 'India' LIMIT 1;`);
  const inId = inRes.rows[0]?.id || 1;
  await pool.query(`
    INSERT INTO public.tbl_state_mst (state_code, state_name, country_id)
    VALUES 
      ('ST001', 'Kerala', $1),
      ('ST002', 'Tamil Nadu', $1),
      ('ST003', 'Karnataka', $1),
      ('ST004', 'Maharashtra', $1)
    ON CONFLICT (state_code) DO NOTHING;
  `, [inId]);

  // District
  const klRes = await pool.query(`SELECT id FROM public.tbl_state_mst WHERE state_name = 'Kerala' LIMIT 1;`);
  const klId = klRes.rows[0]?.id || 1;
  await pool.query(`
    INSERT INTO public.tbl_district_mst (district_code, district_name, state_id)
    VALUES 
      ('DST001', 'Ernakulam', $1),
      ('DST002', 'Thrissur', $1),
      ('DST003', 'Thiruvananthapuram', $1),
      ('DST004', 'Kozhikode', $1)
    ON CONFLICT (district_code) DO NOTHING;
  `, [klId]);

  // City
  const ekmRes = await pool.query(`SELECT id FROM public.tbl_district_mst WHERE district_name = 'Ernakulam' LIMIT 1;`);
  const ekmId = ekmRes.rows[0]?.id || 1;
  await pool.query(`
    INSERT INTO public.tbl_city_mst (city_code, city_name, district_id, state_id, pin_code)
    VALUES 
      ('CTY001', 'Kochi', $1, $2, '682001'),
      ('CTY002', 'Aluva', $1, $2, '683101'),
      ('CTY003', 'Kakkanad', $1, $2, '682030'),
      ('CTY004', 'Angamaly', $1, $2, '683572')
    ON CONFLICT (city_code) DO NOTHING;
  `, [ekmId, klId]);

  // Zone
  await pool.query(`
    INSERT INTO public.tbl_zone_mst (zone_code, zone_name, description)
    VALUES 
      ('ZN001', 'South Zone', 'Southern territory logistics operations'),
      ('ZN002', 'West Zone', 'Western state commercial shipping operations'),
      ('ZN003', 'North Zone', 'Northern freight handling corridor')
    ON CONFLICT (zone_code) DO NOTHING;
  `);

  // Region
  const szRes = await pool.query(`SELECT id FROM public.tbl_zone_mst WHERE zone_name = 'South Zone' LIMIT 1;`);
  const szId = szRes.rows[0]?.id || 1;
  await pool.query(`
    INSERT INTO public.tbl_region_mst (region_code, region_name, zone_id, description)
    VALUES 
      ('REG001', 'South Region', $1, 'Central South fleet coverage'),
      ('REG002', 'Kerala Region', $1, 'Kerala state intra-city and express operations'),
      ('REG003', 'Karnataka Region', $1, 'Karnataka logistics belt')
    ON CONFLICT (region_code) DO NOTHING;
  `, [szId]);

  // Area
  const kochiCityRes = await pool.query(`SELECT id FROM public.tbl_city_mst WHERE city_name = 'Kochi' LIMIT 1;`);
  const kochiCityId = kochiCityRes.rows[0]?.id || 1;
  const klRegRes = await pool.query(`SELECT id FROM public.tbl_region_mst WHERE region_name = 'Kerala Region' LIMIT 1;`);
  const klRegId = klRegRes.rows[0]?.id || 1;
  await pool.query(`
    INSERT INTO public.tbl_area_mst (area_code, area_name, region_id, city_id, description)
    VALUES 
      ('AR001', 'Kochi Central', $1, $2, 'Downtown metropolitan delivery area'),
      ('AR002', 'Willingdon Island Port', $1, $2, 'Port and sea cargo transit area'),
      ('AR003', 'Kakkanad Tech Belt', $1, $2, 'Suburban tech park logistics area')
    ON CONFLICT (area_code) DO NOTHING;
  `, [klRegId, kochiCityId]);

  // Sub-Area
  const kochiAreaRes = await pool.query(`SELECT id FROM public.tbl_area_mst WHERE area_name = 'Kochi Central' LIMIT 1;`);
  const kochiAreaId = kochiAreaRes.rows[0]?.id || 1;
  await pool.query(`
    INSERT INTO public.tbl_sub_area_mst (sub_area_code, sub_area_name, area_id, description)
    VALUES 
      ('SAR001', 'Kakkanad', $1, 'InfoPark and SmartCity sector'),
      ('SAR002', 'Kaloor', $1, 'Transit junction and express parcel zone'),
      ('SAR003', 'Marine Drive', $1, 'Coastal business and courier cluster')
    ON CONFLICT (sub_area_code) DO NOTHING;
  `, [kochiAreaId]);

  // Branch / Depot
  await pool.query(`
    INSERT INTO public.tbl_branch_mst (branch_code, branch_name, branch_type, city_id, state_id, area_id, region_id, address, contact_person, contact_number)
    VALUES 
      ('BR001', 'Kochi Depot', 'Depot', $1, $2, $3, $4, 'Plot 14, Industrial Estate, Kalamassery, Kochi', 'Suresh Menon', '+91 98470 11223'),
      ('BR002', 'Ernakulam Main Branch', 'Branch', $1, $2, $3, $4, 'FleetSphere Towers, MG Road, Kochi', 'Priya Nambiar', '+91 98470 44556'),
      ('BR003', 'Kakkanad Fleet Unit', 'Depot', $1, $2, $3, $4, 'Near InfoPark Expressway, Kakkanad', 'Anand Kumar', '+91 98470 77889')
    ON CONFLICT (branch_code) DO NOTHING;
  `, [kochiCityId, klId, kochiAreaId, klRegId]);

  // Warehouse / Hub
  const brRes = await pool.query(`SELECT id FROM public.tbl_branch_mst WHERE branch_code = 'BR001' LIMIT 1;`);
  const brId = brRes.rows[0]?.id || 1;
  await pool.query(`
    INSERT INTO public.tbl_hub_mst (hub_code, hub_name, hub_type, branch_id, city_id, area_id, storage_capacity, address)
    VALUES 
      ('HUB001', 'Central Distribution Hub', 'Hub', $1, $2, $3, '50,000 sq ft / 2,000 pallets', 'Logistics Park, Kalamassery Bypass, Kochi'),
      ('HUB002', 'Kochi Transit Yard', 'Transfer Station', $1, $2, $3, '20,000 sq ft / 40 heavy trailers', 'Container Road Junction, Bolgatty'),
      ('HUB003', 'Willingdon Port Terminal', 'Warehouse', $1, $2, $3, '35,000 sq ft / Container handling', 'Wharf Road, Willingdon Island')
    ON CONFLICT (hub_code) DO NOTHING;
  `, [brId, kochiCityId, kochiAreaId]);

  // Department
  await pool.query(`
    INSERT INTO public.tbl_department_mst (dept_code, dept_name, description)
    VALUES 
      ('DEP001', 'Transport Operations', 'Daily vehicle dispatches, trip coordination, and fleet tracking'),
      ('DEP002', 'Fleet Maintenance', 'Vehicle servicing, preventive maintenance, and spares inventory'),
      ('DEP003', 'Human Resources', 'Driver recruitment, shift compliance, and workforce records'),
      ('DEP004', 'Finance & Billing', 'Trip settlements, freight invoicing, and driver payroll')
    ON CONFLICT (dept_code) DO NOTHING;
  `);

  // Designation
  await pool.query(`
    INSERT INTO public.tbl_designation_master (designation_code, designation_name, description)
    VALUES 
      ('DES001', 'Fleet Manager', 'Supervises depot operations, vehicle utilization, and safety policies'),
      ('DES002', 'Fleet Supervisor', 'Direct manager for drivers, dispatches, and daily route planning'),
      ('DES003', 'Heavy Commercial Driver', 'Licensed operator for inter-city heavy goods vehicles and trailers'),
      ('DES004', 'Light Commercial Driver', 'Operator for last-mile delivery vans and intra-city vehicles'),
      ('DES005', 'Fleet Maintenance Engineer', 'Technical inspector and maintenance supervisor for fleet assets'),
      ('DES006', 'HR Executive', 'Workforce administrator for driver onboarding and compliance')
    ON CONFLICT (designation_code) DO NOTHING;
  `);

  // Employee Type
  await pool.query(`
    INSERT INTO public.tbl_employee_type_mst (type_code, type_name, description)
    VALUES 
      ('TYP001', 'Permanent', 'Direct payroll permanent employee'),
      ('TYP002', 'Contract', 'Third-party agency or annual contract staff'),
      ('TYP003', 'Temporary / Seasonal', 'Short-term peak volume hire')
    ON CONFLICT (type_code) DO NOTHING;
  `);

  // Employment Status
  await pool.query(`
    INSERT INTO public.tbl_employment_status_mst (status_code, status_name, description)
    VALUES 
      ('STA001', 'Active', 'Fully active and available for route assignment'),
      ('STA002', 'On Leave', 'Authorized temporary leave of absence'),
      ('STA003', 'Probation', 'Initial evaluation period'),
      ('STA004', 'Resigned', 'Formal resignation processed')
    ON CONFLICT (status_code) DO NOTHING;
  `);

  // Org Level
  await pool.query(`
    INSERT INTO public.tbl_org_level_mst (level_code, level_name, hierarchy_order, description)
    VALUES 
      ('LVL001', 'Division', 1, 'National or business unit division'),
      ('LVL002', 'Zone', 2, 'Geographic multi-state operating zone'),
      ('LVL003', 'Region', 3, 'Operational region within zone'),
      ('LVL004', 'Branch / Depot', 4, 'Physical company operating branch or terminal')
    ON CONFLICT (level_code) DO NOTHING;
  `);

  // Org Unit
  const lvl1Res = await pool.query(`SELECT id FROM public.tbl_org_level_mst WHERE level_code = 'LVL003' LIMIT 1;`);
  const lvl1Id = lvl1Res.rows[0]?.id || 1;
  await pool.query(`
    INSERT INTO public.tbl_org_unit_mst (unit_code, unit_name, org_level_id, description)
    VALUES 
      ('UNT001', 'South Fleet Division', $1, 'Corporate division supervising southern operations'),
      ('UNT002', 'Kochi Logistics Branch', $1, 'Branch operational management unit'),
      ('UNT003', 'Kalamassery Depot Unit', $1, 'Terminal operational facility')
    ON CONFLICT (unit_code) DO NOTHING;
  `, [lvl1Id]);

  // Reporting Structure
  const desMgrRes = await pool.query(`SELECT id FROM public.tbl_designation_master WHERE designation_code = 'DES001' LIMIT 1;`);
  const desSupRes = await pool.query(`SELECT id FROM public.tbl_designation_master WHERE designation_code = 'DES002' LIMIT 1;`);
  const desDrvRes = await pool.query(`SELECT id FROM public.tbl_designation_master WHERE designation_code = 'DES003' LIMIT 1;`);
  const deptOpsRes = await pool.query(`SELECT id FROM public.tbl_department_mst WHERE dept_code = 'DEP001' LIMIT 1;`);

  if (desMgrRes.rows[0] && desSupRes.rows[0] && desDrvRes.rows[0]) {
    await pool.query(`
      INSERT INTO public.tbl_reporting_structure_mst (structure_code, designation_id, reports_to_designation_id, department_id, notes)
      VALUES 
        ('REP001', $1, $2, $3, 'Commercial drivers report directly to Fleet Supervisor'),
        ('REP002', $2, $4, $3, 'Fleet Supervisors report to Fleet Manager')
      ON CONFLICT (structure_code) DO NOTHING;
    `, [desDrvRes.rows[0].id, desSupRes.rows[0].id, deptOpsRes.rows[0]?.id, desMgrRes.rows[0].id]);
  }

  // Shift Master
  await pool.query(`
    INSERT INTO public.tbl_shift_mst (shift_code, shift_name, start_time, end_time, description)
    VALUES 
      ('SHF001', 'Morning Shift', '06:00', '14:00', 'Early morning dispatches and delivery runs'),
      ('SHF002', 'General Day Shift', '09:00', '18:00', 'Standard administrative and warehouse operating hours'),
      ('SHF003', 'Evening Shift', '14:00', '22:00', 'Afternoon sorting and inter-city trunking'),
      ('SHF004', 'Night Express Shift', '22:00', '06:00', 'Long-haul night freight transport')
    ON CONFLICT (shift_code) DO NOTHING;
  `);

  // Skill Master
  await pool.query(`
    INSERT INTO public.tbl_skill_mst (skill_code, skill_name, validity_years, description)
    VALUES 
      ('SKL001', 'Heavy Commercial Vehicle Licence (HCV)', 3, 'Class 3 heavy multi-axle freight license'),
      ('SKL002', 'Hazardous Materials Transport (HAZMAT)', 1, 'Certified handling for chemicals and fuel haulage'),
      ('SKL003', 'First Aid & CPR Certification', 2, 'Certified emergency road first responder'),
      ('SKL004', 'Defensive Driving & Eco-Mobility', 2, 'Fuel efficient and accident-prevention driving accreditation')
    ON CONFLICT (skill_code) DO NOTHING;
  `);

  // Document Type Master
  await pool.query(`
    INSERT INTO public.tbl_document_type_mst (doc_type_code, doc_type_name, is_mandatory, description)
    VALUES 
      ('DOC001', 'Commercial Driving Licence (Front & Back)', true, 'Government issued valid transport driving licence'),
      ('DOC002', 'National Identity Proof (Aadhaar / PAN / National ID)', true, 'Statutory personal identification record'),
      ('DOC003', 'Police Verification Certificate', false, 'Criminal background check verification clearance'),
      ('DOC004', 'Medical & Vision Fitness Certificate', true, 'Certified annual physical and optical fitness for drivers')
    ON CONFLICT (doc_type_code) DO NOTHING;
  `);

  // Employee Master
  const desMgrId = desMgrRes.rows[0]?.id || null;
  const desSupId = desSupRes.rows[0]?.id || null;
  const desDrvId = desDrvRes.rows[0]?.id || null;
  const deptId = deptOpsRes.rows[0]?.id || null;
  const typRes = await pool.query(`SELECT id FROM public.tbl_employee_type_mst WHERE type_code = 'TYP001' LIMIT 1;`);
  const typId = typRes.rows[0]?.id || null;
  const staRes = await pool.query(`SELECT id FROM public.tbl_employment_status_mst WHERE status_code = 'STA001' LIMIT 1;`);
  const staId = staRes.rows[0]?.id || null;
  const shfRes = await pool.query(`SELECT id FROM public.tbl_shift_mst WHERE shift_code = 'SHF001' LIMIT 1;`);
  const shfId = shfRes.rows[0]?.id || null;

  // Insert Manager first
  const mgrRes = await pool.query(`
    INSERT INTO public.tbl_employee_master 
      (employee_code, first_name, last_name, email, phone_number, joining_date, designation_id, department_id, employee_type_id, employment_status_id, branch_id, region_id, area_id, shift_id)
    VALUES 
      ('EMP001', 'John', 'Mathew', 'john.mathew@client001.com', '+91 98470 11001', '2023-01-15', $1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (employee_code) DO UPDATE SET updated_at = NOW()
    RETURNING id;
  `, [desMgrId, deptId, typId, staId, brId, klRegId, kochiAreaId, shfId]);
  const mgrId = mgrRes.rows[0]?.id;

  // Insert Supervisor reporting to Manager
  const supRes = await pool.query(`
    INSERT INTO public.tbl_employee_master 
      (employee_code, first_name, last_name, email, phone_number, joining_date, designation_id, department_id, employee_type_id, employment_status_id, branch_id, manager_id, region_id, area_id, shift_id)
    VALUES 
      ('EMP002', 'Rahul', 'Kumar', 'rahul.kumar@client001.com', '+91 98470 11002', '2023-06-01', $1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (employee_code) DO UPDATE SET updated_at = NOW()
    RETURNING id;
  `, [desSupId, deptId, typId, staId, brId, mgrId, klRegId, kochiAreaId, shfId]);
  const supId = supRes.rows[0]?.id;

  // Insert Driver reporting to Supervisor
  await pool.query(`
    INSERT INTO public.tbl_employee_master 
      (employee_code, first_name, last_name, email, phone_number, joining_date, designation_id, department_id, employee_type_id, employment_status_id, branch_id, manager_id, region_id, area_id, shift_id)
    VALUES 
      ('EMP003', 'Alex', 'Varghese', 'alex.varghese@client001.com', '+91 98470 11003', '2024-02-10', $1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (employee_code) DO UPDATE SET updated_at = NOW();
  `, [desDrvId, deptId, typId, staId, brId, supId, klRegId, kochiAreaId, shfId]);

  console.log('✓ Seeded sample master records.');

  // ==========================================================================
  // SECTION 3: REGISTER ALL 21 DYNAMIC MASTERS IN HEADER & SETUP TABLES
  // ==========================================================================
  console.log('\n--- 3. Registering Dynamic Master Metadata ---');

  const dynamicMasters = [
    // 1. Country
    {
      code: 'country',
      table: 'tbl_country_mst',
      name: 'Country Master',
      listTitle: 'Countries',
      desc: 'National jurisdictions, ISO country codes, and international phone prefixes',
      fields: [
        { col: 'country_code', label: 'Country Code', type: 'text', req: true, list: true, auto: true, pfx: 'CN', len: 3, pri: 1 },
        { col: 'country_name', label: 'Country Name', type: 'text', req: true, list: true, pri: 2 },
        { col: 'iso_code', label: 'ISO Code', type: 'text', req: false, list: true, pri: 3 },
        { col: 'phone_code', label: 'Dialing Code', type: 'text', req: false, list: true, pri: 4 },
        { col: 'currency_code', label: 'Currency', type: 'text', req: false, list: true, pri: 5 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 6 },
      ],
    },
    // 2. State
    {
      code: 'state',
      table: 'tbl_state_mst',
      name: 'State Master',
      listTitle: 'States & Provinces',
      desc: 'States and provinces associated with countries',
      fields: [
        { col: 'state_code', label: 'State Code', type: 'text', req: true, list: true, auto: true, pfx: 'ST', len: 3, pri: 1 },
        { col: 'state_name', label: 'State Name', type: 'text', req: true, list: true, pri: 2 },
        {
          col: 'country_id', label: 'Country', type: 'dropdown', req: true, list: true, pri: 3,
          table: 'tbl_country_mst', val: 'id', lbl: 'country_name',
        },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 4 },
      ],
    },
    // 3. District
    {
      code: 'district',
      table: 'tbl_district_mst',
      name: 'District Master',
      listTitle: 'Districts & Counties',
      desc: 'Administrative districts linked to states',
      fields: [
        { col: 'district_code', label: 'District Code', type: 'text', req: true, list: true, auto: true, pfx: 'DST', len: 3, pri: 1 },
        { col: 'district_name', label: 'District Name', type: 'text', req: true, list: true, pri: 2 },
        {
          col: 'state_id', label: 'State', type: 'dropdown', req: true, list: true, pri: 3,
          table: 'tbl_state_mst', val: 'id', lbl: 'state_name',
        },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 4 },
      ],
    },
    // 4. City
    {
      code: 'city',
      table: 'tbl_city_mst',
      name: 'City / Town Master',
      listTitle: 'Cities & Towns',
      desc: 'Cities, postal districts, and delivery towns',
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
    // 5. Zone
    {
      code: 'zone',
      table: 'tbl_zone_mst',
      name: 'Zone Master',
      listTitle: 'Operating Zones',
      desc: 'Macro operating zones coordinating broad regional fleet logistics',
      fields: [
        { col: 'zone_code', label: 'Zone Code', type: 'text', req: true, list: true, auto: true, pfx: 'ZN', len: 3, pri: 1 },
        { col: 'zone_name', label: 'Zone Name', type: 'text', req: true, list: true, pri: 2 },
        { col: 'description', label: 'Description', type: 'textarea', req: false, list: true, pri: 3 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 4 },
      ],
    },
    // 6. Region
    {
      code: 'region',
      table: 'tbl_region_mst',
      name: 'Region Master',
      listTitle: 'Operational Regions',
      desc: 'Operational territories optionally linked to higher-level operating zones',
      fields: [
        { col: 'region_code', label: 'Region Code', type: 'text', req: true, list: true, auto: true, pfx: 'REG', len: 3, pri: 1 },
        { col: 'region_name', label: 'Region Name', type: 'text', req: true, list: true, pri: 2 },
        {
          col: 'zone_id', label: 'Operating Zone', type: 'dropdown', req: false, list: true, pri: 3,
          table: 'tbl_zone_mst', val: 'id', lbl: 'zone_name',
        },
        { col: 'description', label: 'Description', type: 'textarea', req: false, list: true, pri: 4 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 5 },
      ],
    },
    // 7. Area
    {
      code: 'area',
      table: 'tbl_area_mst',
      name: 'Area Master',
      listTitle: 'Operational Areas',
      desc: 'Operating sectors linked flexibly to regions, branches, or cities',
      fields: [
        { col: 'area_code', label: 'Area Code', type: 'text', req: true, list: true, auto: true, pfx: 'AR', len: 3, pri: 1 },
        { col: 'area_name', label: 'Area Name', type: 'text', req: true, list: true, pri: 2 },
        {
          col: 'region_id', label: 'Region', type: 'dropdown', req: false, list: true, pri: 3,
          table: 'tbl_region_mst', val: 'id', lbl: 'region_name',
        },
        {
          col: 'city_id', label: 'City', type: 'dropdown', req: false, list: true, pri: 4,
          table: 'tbl_city_mst', val: 'id', lbl: 'city_name',
        },
        { col: 'description', label: 'Description', type: 'textarea', req: false, list: true, pri: 5 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 6 },
      ],
    },
    // 8. Sub-Area
    {
      code: 'sub-area',
      table: 'tbl_sub_area_mst',
      name: 'Sub-Area Master',
      listTitle: 'Sub-Areas & Sectors',
      desc: 'Micro-delivery clusters and operational sub-areas within larger areas',
      fields: [
        { col: 'sub_area_code', label: 'Sub-Area Code', type: 'text', req: true, list: true, auto: true, pfx: 'SAR', len: 3, pri: 1 },
        { col: 'sub_area_name', label: 'Sub-Area Name', type: 'text', req: true, list: true, pri: 2 },
        {
          col: 'area_id', label: 'Area', type: 'dropdown', req: true, list: true, pri: 3,
          table: 'tbl_area_mst', val: 'id', lbl: 'area_name',
        },
        { col: 'description', label: 'Description', type: 'textarea', req: false, list: true, pri: 4 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 5 },
      ],
    },
    // 9. Branch / Depot
    {
      code: 'branch',
      table: 'tbl_branch_mst',
      name: 'Branch / Depot Master',
      listTitle: 'Branches & Depots',
      desc: 'Company operating terminals, regional depots, and maintenance yards',
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
    // 10. Warehouse / Hub
    {
      code: 'hub',
      table: 'tbl_hub_mst',
      name: 'Warehouse / Hub Master',
      listTitle: 'Warehouses & Logistics Hubs',
      desc: 'Storage centers, sorting facilities, and transfer hubs',
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
      table: 'tbl_department_mst',
      name: 'Department Master',
      listTitle: 'Departments',
      desc: 'Functional corporate and operations divisions',
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
      table: 'tbl_designation_master',
      name: 'Designation Master',
      listTitle: 'Job Titles & Designations',
      desc: 'Official workplace job titles and organizational roles',
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
      table: 'tbl_employee_type_mst',
      name: 'Employee Type Master',
      listTitle: 'Employment Categories',
      desc: 'Employment categories (Permanent, Contract, Temporary, Seasonal)',
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
      table: 'tbl_employment_status_mst',
      name: 'Employment Status Master',
      listTitle: 'Employment Statuses',
      desc: 'Staff operational lifecycle states (Active, On Leave, Resigned)',
      fields: [
        { col: 'status_code', label: 'Status Code', type: 'text', req: true, list: true, auto: true, pfx: 'STA', len: 3, pri: 1 },
        { col: 'status_name', label: 'Status Name', type: 'text', req: true, list: true, pri: 2 },
        { col: 'description', label: 'Description', type: 'textarea', req: false, list: true, pri: 3 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 4 },
      ],
    },
    // 15. Organization Level
    {
      code: 'org-level',
      table: 'tbl_org_level_mst',
      name: 'Organization Level Master',
      listTitle: 'Organization Levels',
      desc: 'Configurable enterprise hierarchy tiers (Division, Region, Branch, Depot)',
      fields: [
        { col: 'level_code', label: 'Level Code', type: 'text', req: true, list: true, auto: true, pfx: 'LVL', len: 3, pri: 1 },
        { col: 'level_name', label: 'Level Name', type: 'text', req: true, list: true, pri: 2 },
        { col: 'hierarchy_order', label: 'Tier Sequence', type: 'number', req: true, list: true, pri: 3 },
        { col: 'description', label: 'Description', type: 'textarea', req: false, list: true, pri: 4 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 5 },
      ],
    },
    // 16. Organization Unit
    {
      code: 'org-unit',
      table: 'tbl_org_unit_mst',
      name: 'Organization Unit Master',
      listTitle: 'Organization Units',
      desc: 'Actual operating business units across the configured hierarchy',
      fields: [
        { col: 'unit_code', label: 'Unit Code', type: 'text', req: true, list: true, auto: true, pfx: 'UNT', len: 3, pri: 1 },
        { col: 'unit_name', label: 'Unit Name', type: 'text', req: true, list: true, pri: 2 },
        {
          col: 'org_level_id', label: 'Hierarchy Level', type: 'dropdown', req: true, list: true, pri: 3,
          table: 'tbl_org_level_mst', val: 'id', lbl: 'level_name',
        },
        {
          col: 'parent_unit_id', label: 'Parent Unit', type: 'dropdown', req: false, list: true, pri: 4,
          table: 'tbl_org_unit_mst', val: 'id', lbl: 'unit_name',
        },
        { col: 'description', label: 'Description', type: 'textarea', req: false, list: true, pri: 5 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 6 },
      ],
    },
    // 17. Reporting Structure
    {
      code: 'reporting-structure',
      table: 'tbl_reporting_structure_mst',
      name: 'Reporting Structure',
      listTitle: 'Reporting Relationships',
      desc: 'Supervisory chains of command (e.g. Driver reports to Fleet Supervisor)',
      fields: [
        { col: 'structure_code', label: 'Rule Code', type: 'text', req: true, list: true, auto: true, pfx: 'REP', len: 3, pri: 1 },
        {
          col: 'designation_id', label: 'Subordinate Job Title', type: 'dropdown', req: true, list: true, pri: 2,
          table: 'tbl_designation_master', val: 'id', lbl: 'designation_name',
        },
        {
          col: 'reports_to_designation_id', label: 'Reporting Manager Title', type: 'dropdown', req: true, list: true, pri: 3,
          table: 'tbl_designation_master', val: 'id', lbl: 'designation_name',
        },
        {
          col: 'department_id', label: 'Department', type: 'dropdown', req: false, list: true, pri: 4,
          table: 'tbl_department_mst', val: 'id', lbl: 'dept_name',
        },
        { col: 'notes', label: 'Supervisory Notes', type: 'textarea', req: false, list: true, pri: 5 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 6 },
      ],
    },
    // 18. Shift Master
    {
      code: 'shift',
      table: 'tbl_shift_mst',
      name: 'Shift Master',
      listTitle: 'Work Shifts',
      desc: 'Operational shift windows and driver duty schedules',
      fields: [
        { col: 'shift_code', label: 'Shift Code', type: 'text', req: true, list: true, auto: true, pfx: 'SHF', len: 3, pri: 1 },
        { col: 'shift_name', label: 'Shift Name', type: 'text', req: true, list: true, pri: 2 },
        { col: 'start_time', label: 'Start Time (HH:MM)', type: 'text', req: true, list: true, pri: 3 },
        { col: 'end_time', label: 'End Time (HH:MM)', type: 'text', req: true, list: true, pri: 4 },
        { col: 'description', label: 'Description', type: 'textarea', req: false, list: true, pri: 5 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 6 },
      ],
    },
    // 19. Skill / Certification
    {
      code: 'skill',
      table: 'tbl_skill_mst',
      name: 'Skill / Certification Master',
      listTitle: 'Skills & Certifications',
      desc: 'Driver licenses, hazardous materials compliance, and technical accreditations',
      fields: [
        { col: 'skill_code', label: 'Skill Code', type: 'text', req: true, list: true, auto: true, pfx: 'SKL', len: 3, pri: 1 },
        { col: 'skill_name', label: 'Skill / Certification Name', type: 'text', req: true, list: true, pri: 2 },
        { col: 'validity_years', label: 'Validity Period (Years)', type: 'number', req: false, list: true, pri: 3 },
        { col: 'description', label: 'Certification Details', type: 'textarea', req: false, list: true, pri: 4 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 5 },
      ],
    },
    // 20. Document Type
    {
      code: 'document-type',
      table: 'tbl_document_type_mst',
      name: 'Document Type Master',
      listTitle: 'Document Categories',
      desc: 'Staff compliance, verification, and driver licensing document categories',
      fields: [
        { col: 'doc_type_code', label: 'Type Code', type: 'text', req: true, list: true, auto: true, pfx: 'DOC', len: 3, pri: 1 },
        { col: 'doc_type_name', label: 'Document Name', type: 'text', req: true, list: true, pri: 2 },
        { col: 'is_mandatory', label: 'Mandatory Document', type: 'toggle', req: false, list: true, pri: 3 },
        { col: 'description', label: 'Description', type: 'textarea', req: false, list: true, pri: 4 },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 5 },
      ],
    },
    // 21. Employee Master (Relational Profile referencing all enterprise masters!)
    {
      code: 'employee-master',
      table: 'tbl_employee_master',
      name: 'Employee Master',
      listTitle: 'Employee Directory & Profiles',
      desc: 'Central staff profiles referencing enterprise designations, branches, managers, shifts and locations',
      fields: [
        { col: 'employee_code', label: 'Employee Code', type: 'text', req: true, list: true, auto: true, pfx: 'EMP', len: 3, pri: 1 },
        { col: 'first_name', label: 'First Name', type: 'text', req: true, list: true, pri: 2 },
        { col: 'last_name', label: 'Last Name', type: 'text', req: false, list: true, pri: 3 },
        { col: 'email', label: 'Email Address', type: 'text', req: false, list: true, pri: 4 },
        { col: 'phone_number', label: 'Contact Phone', type: 'text', req: false, list: true, pri: 5 },
        { col: 'joining_date', label: 'Joining Date', type: 'date', req: false, list: true, pri: 6 },
        {
          col: 'designation_id', label: 'Designation / Role', type: 'dropdown', req: true, list: true, pri: 7,
          table: 'tbl_designation_master', val: 'id', lbl: 'designation_name',
        },
        {
          col: 'department_id', label: 'Department', type: 'dropdown', req: false, list: true, pri: 8,
          table: 'tbl_department_mst', val: 'id', lbl: 'dept_name',
        },
        {
          col: 'employee_type_id', label: 'Employment Type', type: 'dropdown', req: false, list: true, pri: 9,
          table: 'tbl_employee_type_mst', val: 'id', lbl: 'type_name',
        },
        {
          col: 'employment_status_id', label: 'Status', type: 'dropdown', req: false, list: true, pri: 10,
          table: 'tbl_employment_status_mst', val: 'id', lbl: 'status_name',
        },
        {
          col: 'branch_id', label: 'Assigned Branch / Depot', type: 'dropdown', req: false, list: true, pri: 11,
          table: 'tbl_branch_mst', val: 'id', lbl: 'branch_name',
        },
        {
          col: 'manager_id', label: 'Reporting Manager', type: 'dropdown', req: false, list: true, pri: 12,
          table: 'tbl_employee_master', val: 'id', lbl: 'first_name',
        },
        {
          col: 'region_id', label: 'Assigned Region', type: 'dropdown', req: false, list: false, pri: 13,
          table: 'tbl_region_mst', val: 'id', lbl: 'region_name',
        },
        {
          col: 'area_id', label: 'Assigned Area', type: 'dropdown', req: false, list: false, pri: 14,
          table: 'tbl_area_mst', val: 'id', lbl: 'area_name',
          dep: 'region_id', depField: 'region_id',
        },
        {
          col: 'shift_id', label: 'Work Shift', type: 'dropdown', req: false, list: true, pri: 15,
          table: 'tbl_shift_mst', val: 'id', lbl: 'shift_name',
        },
        { col: 'is_active', label: 'Active', type: 'toggle', req: false, list: true, pri: 16 },
      ],
    },
  ];

  for (const dm of dynamicMasters) {
    const headRes = await pool.query(`
      INSERT INTO public.tbl_dynamicmaster_header 
        (master_code, table_name, primary_key, header_name, list_title, description, is_active)
      VALUES 
        ($1, $2, 'id', $3, $4, $5, true)
      ON CONFLICT (master_code) 
      DO UPDATE SET 
        table_name = EXCLUDED.table_name,
        header_name = EXCLUDED.header_name,
        list_title = EXCLUDED.list_title,
        description = EXCLUDED.description,
        updated_at = NOW()
      RETURNING master_id;
    `, [dm.code, dm.table, dm.name, dm.listTitle, dm.desc]);

    const masterId = headRes.rows[0].master_id;

    // Reset setup fields for this master
    await pool.query(`DELETE FROM public.tbl_dynamicmaster_setup WHERE master_id = $1;`, [masterId]);

    for (const f of dm.fields) {
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
    console.log(`✓ Configured Dynamic Master: ${dm.name} (${dm.code})`);
  }

  // ==========================================================================
  // SECTION 4: MENU HEADERS & SUB-MENUS REGISTRATION
  // ==========================================================================
  console.log('\n--- 4. Registering Menu Headers & Sub-Menus ---');

  // Headers:
  // 1: Main (order 1)
  // 2: Location Masters (order 2)
  // 3: Organization Masters (order 3)
  // 4: System Masters (order 4)
  const headersConfig = [
    { code: 'main', name: 'Main', icon: 'LayoutDashboard', order: 1 },
    { code: 'location', name: 'Location Masters', icon: 'Globe', order: 2 },
    { code: 'organization', name: 'Organization Masters', icon: 'Users', order: 3 },
    { code: 'masters', name: 'System Masters', icon: 'Settings', order: 4 },
  ];

  const headerIdMap = {};
  for (const h of headersConfig) {
    const res = await pool.query(`
      INSERT INTO public.tbl_menu_mst_header (header_name, header_code, icon_name, display_order, is_active)
      VALUES ($1, $2, $3, $4, true)
      ON CONFLICT (header_name) 
      DO UPDATE SET 
        header_code = EXCLUDED.header_code,
        icon_name = EXCLUDED.icon_name,
        display_order = EXCLUDED.display_order,
        updated_at = NOW()
      RETURNING header_id, header_name;
    `, [h.name, h.code, h.icon, h.order]);
    headerIdMap[h.name] = res.rows[0].header_id;
  }
  console.log('✓ Menu Headers registered:', headerIdMap);

  // Sub-menus catalog
  const subMenusConfig = [
    // -------------------------------------------------------------
    // Under Main (Standard operational pages)
    // -------------------------------------------------------------
    {
      header: 'Main',
      name: 'Dashboard',
      route: '/dashboard',
      icon: 'LayoutDashboard',
      order: 1,
      sidebar: true,
      desc: 'Real-time overview of fleet activities, active dispatches, and key performance indicators',
    },
    {
      header: 'Main',
      name: 'Attendance Tracker',
      route: '/attendance',
      icon: 'Clock',
      order: 3,
      sidebar: true,
      desc: 'Driver and staff check-ins, biometric logs, duty rosters, and shift attendance',
    },
    {
      header: 'Main',
      name: 'Payroll Summary',
      route: '/payroll',
      icon: 'DollarSign',
      order: 4,
      sidebar: true,
      desc: 'Driver wage settlements, trip allowances, bonus calculations, and payroll runs',
    },
    {
      header: 'Main',
      name: 'Documents',
      route: '/documents',
      icon: 'FileText',
      order: 7,
      sidebar: true,
      desc: 'Vehicle permits, road tax certificates, transit insurance, and compliance documents',
    },
    {
      header: 'Main',
      name: 'Calendar & Schedules',
      route: '/calendar',
      icon: 'Calendar',
      order: 8,
      sidebar: true,
      desc: 'Fleet trip schedules, statutory inspection dates, and vehicle service bookings',
    },
    {
      header: 'Main',
      name: 'Settings',
      route: '/settings',
      icon: 'Settings',
      order: 9,
      sidebar: false,
      desc: 'Client enterprise preferences, telematics integrations, and security policies',
    },

    // -------------------------------------------------------------
    // Under Location Masters (2.1 Location & Geography Masters)
    // -------------------------------------------------------------
    {
      header: 'Location Masters',
      name: 'Country Master',
      route: '/master/country',
      icon: 'Globe',
      order: 10,
      sidebar: false,
      desc: 'Country codes, sovereign jurisdictions, and international dial prefixes (e.g. India)',
    },
    {
      header: 'Location Masters',
      name: 'State Master',
      route: '/master/state',
      icon: 'Map',
      order: 11,
      sidebar: false,
      desc: 'States and provinces linked to countries (e.g. Kerala, Tamil Nadu, Karnataka)',
    },
    {
      header: 'Location Masters',
      name: 'District Master',
      route: '/master/district',
      icon: 'MapPin',
      order: 12,
      sidebar: false,
      desc: 'Districts and counties linked to states (e.g. Ernakulam, Thrissur)',
    },
    {
      header: 'Location Masters',
      name: 'City / Town Master',
      route: '/master/city',
      icon: 'Building2',
      order: 13,
      sidebar: false,
      desc: 'Cities, postal delivery centers, and delivery clusters (e.g. Kochi, Aluva)',
    },
    {
      header: 'Location Masters',
      name: 'Zone Master',
      route: '/master/zone',
      icon: 'Compass',
      order: 14,
      sidebar: false,
      desc: 'Higher-level operational zones coordinating multi-state fleet territories (e.g. South Zone)',
    },
    {
      header: 'Location Masters',
      name: 'Region Master',
      route: '/master/region',
      icon: 'Navigation',
      order: 15,
      sidebar: false,
      desc: 'Operational regions optionally linked to operating zones (e.g. South Region, Kerala Region)',
    },
    {
      header: 'Location Masters',
      name: 'Area Master',
      route: '/master/area',
      icon: 'Landmark',
      order: 16,
      sidebar: false,
      desc: 'Operational sectors within regions, branches, or cities (e.g. Kochi Central)',
    },
    {
      header: 'Location Masters',
      name: 'Sub-Area Master',
      route: '/master/sub-area',
      icon: 'Locate',
      order: 17,
      sidebar: false,
      desc: 'Granular delivery sectors and micro-clusters within areas (e.g. Kakkanad)',
    },
    {
      header: 'Location Masters',
      name: 'Branch / Depot Master',
      route: '/master/branch',
      icon: 'Building',
      order: 5, // prominent operational branch depot!
      sidebar: true,
      desc: 'Company operating terminals, maintenance depots, and transport yards (e.g. Kochi Depot)',
    },
    {
      header: 'Location Masters',
      name: 'Warehouse / Hub Master',
      route: '/master/hub',
      icon: 'Warehouse',
      order: 6, // prominent operational storage hub!
      sidebar: true,
      desc: 'Central storage warehouses, cross-docking facilities, and cargo hubs',
    },

    // -------------------------------------------------------------
    // Under Organization Masters (2.2 Employee & Organization Masters)
    // -------------------------------------------------------------
    {
      header: 'Organization Masters',
      name: 'Employee Master',
      route: '/master/employee-master',
      icon: 'Users',
      order: 2, // 2nd prominent menu in sidebar!
      sidebar: true,
      desc: 'Enterprise employee profiles linked to designations, branches, managers, shifts and locations',
    },
    {
      header: 'Organization Masters',
      name: 'Designation Master',
      route: '/master/designation',
      icon: 'Briefcase',
      order: 20,
      sidebar: false,
      desc: 'Workplace job titles and organizational responsibilities (e.g. Fleet Manager, Driver, Supervisor)',
    },
    {
      header: 'Organization Masters',
      name: 'Department Master',
      route: '/master/department',
      icon: 'Network',
      order: 21,
      sidebar: false,
      desc: 'Functional enterprise departments (e.g. Transport Operations, HR, Finance, Maintenance)',
    },
    {
      header: 'Organization Masters',
      name: 'Employee Type Master',
      route: '/master/employee-type',
      icon: 'UserCheck',
      order: 22,
      sidebar: false,
      desc: 'Employment categories (Permanent, Contract, Temporary, Seasonal)',
    },
    {
      header: 'Organization Masters',
      name: 'Employment Status Master',
      route: '/master/employment-status',
      icon: 'Activity',
      order: 23,
      sidebar: false,
      desc: 'Operational lifecycle statuses (Active, On Leave, Resigned, Probation)',
    },
    {
      header: 'Organization Masters',
      name: 'Organization Level Master',
      route: '/master/org-level',
      icon: 'GitMerge',
      order: 24,
      sidebar: false,
      desc: 'Configurable enterprise hierarchy tiers (Division, Zone, Region, Branch, Depot)',
    },
    {
      header: 'Organization Masters',
      name: 'Organization Unit Master',
      route: '/master/org-unit',
      icon: 'GitBranch',
      order: 25,
      sidebar: false,
      desc: 'Actual operational units across the configured hierarchy (e.g. South Region, Kochi Branch)',
    },
    {
      header: 'Organization Masters',
      name: 'Reporting Structure',
      route: '/master/reporting-structure',
      icon: 'Workflow',
      order: 26,
      sidebar: false,
      desc: 'Manager and supervisory reporting relationships (e.g. Driver → Fleet Supervisor)',
    },
    {
      header: 'Organization Masters',
      name: 'Shift Master',
      route: '/master/shift',
      icon: 'Clock',
      order: 27,
      sidebar: false,
      desc: 'Duty work shifts and driver schedule windows (Morning, Evening, Night Express)',
    },
    {
      header: 'Organization Masters',
      name: 'Skill / Certification Master',
      route: '/master/skill',
      icon: 'Award',
      order: 28,
      sidebar: false,
      desc: 'Heavy vehicle driving licences, hazardous material handling, and first aid accreditations',
    },
    {
      header: 'Organization Masters',
      name: 'Document Type Master',
      route: '/master/document-type',
      icon: 'FileText',
      order: 29,
      sidebar: false,
      desc: 'Compliance and onboarding document types (Driving licence, National ID, Police clearance)',
    },

    // -------------------------------------------------------------
    // Under System Masters (System configurations)
    // -------------------------------------------------------------
    {
      header: 'System Masters',
      name: 'Hierarchy Master',
      route: '/master/hierarchy',
      icon: 'Layers',
      order: 30,
      sidebar: false,
      desc: 'Enterprise visual organizational tree and unit hierarchy configurations',
    },
    {
      header: 'System Masters',
      name: 'Menu Master',
      route: '/master/menus',
      icon: 'Grid3X3',
      order: 31,
      sidebar: false,
      desc: 'Role permissions, left sidebar 8-menu visibility control, and display ordering',
    },
  ];

  // Delete old sub-menus to cleanly re-seed with fresh header linkages
  await pool.query(`DELETE FROM public.tbl_sub_menu_mst;`);

  const subMenuIds = [];
  for (const sm of subMenusConfig) {
    const headerId = headerIdMap[sm.header];
    if (!headerId) continue;

    const res = await pool.query(`
      INSERT INTO public.tbl_sub_menu_mst 
        (header_id, sub_menu_name, route_path, icon_name, display_order, is_sidebar_visible, description, is_active)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, true)
      RETURNING sub_menu_id, sub_menu_name;
    `, [headerId, sm.name, sm.route, sm.icon, sm.order, sm.sidebar, sm.desc]);

    subMenuIds.push(res.rows[0].sub_menu_id);
  }
  console.log(`✓ Seeded ${subMenuIds.length} Sub-Menus across all 4 categories.`);

  // ==========================================================================
  // SECTION 5: ROLE & EMPLOYEE PERMISSIONS MAPPING
  // ==========================================================================
  console.log('\n--- 5. Granting Full Access to ADMIN Role ---');

  const roleRes = await pool.query(`SELECT u_role_id FROM public.tbl_role_mst WHERE c_role_code = 'ADMIN' LIMIT 1;`);
  if (roleRes.rows.length > 0) {
    const adminRoleId = roleRes.rows[0].u_role_id;
    for (const smId of subMenuIds) {
      await pool.query(`
        INSERT INTO public.tbl_role_menu_mapping 
          (role_id, role_code, sub_menu_id, can_view, can_add, can_edit, can_delete, is_active)
        VALUES 
          ($1, 'ADMIN', $2, true, true, true, true, true)
        ON CONFLICT (role_code, sub_menu_id) DO UPDATE SET 
          can_view = true, can_add = true, can_edit = true, can_delete = true, is_active = true, updated_at = NOW();
      `, [adminRoleId, smId]);
    }
    console.log(`✓ Mapped all ${subMenuIds.length} sub-menus to ADMIN role.`);
  }

  const empRes = await pool.query(`SELECT u_employee_id FROM public.tbl_employee_mst LIMIT 1;`);
  if (empRes.rows.length > 0) {
    const empId = empRes.rows[0].u_employee_id;
    for (const smId of subMenuIds) {
      await pool.query(`
        INSERT INTO public.tbl_employee_menu_mapping 
          (employee_id, sub_menu_id, is_granted, can_view, can_add, can_edit, can_delete, is_active)
        VALUES 
          ($1, $2, true, true, true, true, true, true)
        ON CONFLICT (employee_id, sub_menu_id) DO UPDATE SET 
          is_granted = true, can_view = true, is_active = true, updated_at = NOW();
      `, [empId, smId]);
    }
    console.log(`✓ Mapped all ${subMenuIds.length} sub-menus to employee ${empId}.`);
  }

  // Verify exactly 8 menus are visible in sidebar
  const sidebarCheck = await pool.query(`
    SELECT sub_menu_name, route_path, display_order 
    FROM public.tbl_sub_menu_mst 
    WHERE is_sidebar_visible = TRUE
    ORDER BY display_order ASC;
  `);

  console.log('\n======================================================');
  console.log(`Default Sidebar Visible Menus (${sidebarCheck.rows.length} total):`);
  console.table(sidebarCheck.rows);

  const totalCheck = await pool.query(`
    SELECT h.header_name, COUNT(sm.sub_menu_id)::int AS count
    FROM public.tbl_menu_mst_header h
    LEFT JOIN public.tbl_sub_menu_mst sm ON h.header_id = sm.header_id
    GROUP BY h.header_id, h.header_name
    ORDER BY h.display_order ASC;
  `);
  console.log('\nTotal Modules and Sub-Menus per Header:');
  console.table(totalCheck.rows);

  console.log('=== COMPLETE MASTERS SETUP FINISHED SUCCESSFULLY ===');
  await pool.end();
}

setup().catch(err => {
  console.error('Setup failed with error:', err);
  pool.end();
  process.exit(1);
});

