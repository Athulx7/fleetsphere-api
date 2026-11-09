-- =============================================================================
-- FLEETSPHERE: NEW DATABASE SCHEMA & SEED QUERIES FOR CLIENT DATABASES
-- Target Databases: fleetsphere_clientA, fleetsphere_clientb
-- =============================================================================

-- =============================================================================
-- SECTION 1: MENU MASTER FRAMEWORK
-- =============================================================================

-- 1. Menu Header Table
CREATE TABLE IF NOT EXISTS public.tbl_menu_mst_header (
    header_id      SERIAL PRIMARY KEY,
    header_name    VARCHAR(100) NOT NULL UNIQUE,
    header_code    VARCHAR(50),
    icon_name      VARCHAR(50) DEFAULT 'LayoutDashboard',
    display_order  INTEGER DEFAULT 1,
    is_active      BOOLEAN DEFAULT TRUE,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Sub-Menu Master Table
CREATE TABLE IF NOT EXISTS public.tbl_sub_menu_mst (
    sub_menu_id        SERIAL PRIMARY KEY,
    header_id          INTEGER NOT NULL REFERENCES public.tbl_menu_mst_header(header_id) ON DELETE CASCADE,
    sub_menu_name      VARCHAR(100) NOT NULL,
    route_path         VARCHAR(255) NOT NULL,
    icon_name          VARCHAR(50) DEFAULT 'Layers',
    display_order      INTEGER DEFAULT 1,
    is_sidebar_visible BOOLEAN DEFAULT TRUE,
    description        TEXT,
    is_active          BOOLEAN DEFAULT TRUE,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_header_submenu UNIQUE (header_id, sub_menu_name)
);

-- 3. Role Menu Mapping Table
CREATE TABLE IF NOT EXISTS public.tbl_role_menu_mapping (
    mapping_id    SERIAL PRIMARY KEY,
    role_id       UUID REFERENCES public.tbl_role_mst(u_role_id) ON DELETE CASCADE,
    role_code     VARCHAR(50) NOT NULL,
    sub_menu_id   INTEGER NOT NULL REFERENCES public.tbl_sub_menu_mst(sub_menu_id) ON DELETE CASCADE,
    can_view      BOOLEAN DEFAULT TRUE,
    can_add       BOOLEAN DEFAULT TRUE,
    can_edit      BOOLEAN DEFAULT TRUE,
    can_delete    BOOLEAN DEFAULT TRUE,
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_role_submenu UNIQUE (role_code, sub_menu_id)
);

-- 4. Employee Menu Mapping Table
CREATE TABLE IF NOT EXISTS public.tbl_employee_menu_mapping (
    mapping_id    SERIAL PRIMARY KEY,
    employee_id   UUID NOT NULL REFERENCES public.tbl_employee_mst(u_employee_id) ON DELETE CASCADE,
    sub_menu_id   INTEGER NOT NULL REFERENCES public.tbl_sub_menu_mst(sub_menu_id) ON DELETE CASCADE,
    is_granted    BOOLEAN DEFAULT TRUE,
    can_view      BOOLEAN DEFAULT TRUE,
    can_add       BOOLEAN DEFAULT TRUE,
    can_edit      BOOLEAN DEFAULT TRUE,
    can_delete    BOOLEAN DEFAULT TRUE,
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_emp_submenu UNIQUE (employee_id, sub_menu_id)
);

-- =============================================================================
-- SECTION 2: DYNAMIC MASTER SETUP & HIERARCHY
-- =============================================================================

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

CREATE INDEX IF NOT EXISTS idx_dyn_setup_master_id ON public.tbl_dynamicmaster_setup(master_id);

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

-- =============================================================================
-- SECTION 3: USER MANAGEMENT MODULE TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tbl_user_control_mst (
    id                          SERIAL PRIMARY KEY,
    control_code                VARCHAR(50) NOT NULL UNIQUE DEFAULT 'DEFAULT_CONFIG',
    tenant_code                 VARCHAR(50) DEFAULT 'default',
    is_auto_user_code           BOOLEAN DEFAULT TRUE,
    user_code_prefix            VARCHAR(20) DEFAULT 'USR',
    user_code_length            INTEGER DEFAULT 4,
    allow_manual_code_override  BOOLEAN DEFAULT TRUE,
    allow_closed_code_reuse     BOOLEAN DEFAULT TRUE,
    require_employee_validation BOOLEAN DEFAULT TRUE,
    auto_fetch_employee_name    BOOLEAN DEFAULT TRUE,
    require_reporting_manager   BOOLEAN DEFAULT FALSE,
    require_region_assignment   BOOLEAN DEFAULT FALSE,
    default_role_code           VARCHAR(50) DEFAULT 'OPERATOR',
    description                 TEXT,
    is_active                   BOOLEAN DEFAULT TRUE,
    created_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tbl_user_profile_mst (
    id                    SERIAL PRIMARY KEY,
    user_code             VARCHAR(50) NOT NULL,
    employee_id           INTEGER NOT NULL,
    user_name             VARCHAR(150) NOT NULL,
    email                 VARCHAR(150) NOT NULL,
    phone_number          VARCHAR(50),
    reporting_manager_id  INTEGER REFERENCES public.tbl_user_profile_mst(id) ON DELETE SET NULL,
    reporting_emp_id      INTEGER,
    region_id             INTEGER,
    area_id               INTEGER,
    branch_id             INTEGER,
    shift_id              INTEGER,
    role_code             VARCHAR(50) DEFAULT 'OPERATOR',
    user_status           VARCHAR(20) DEFAULT 'ACTIVE',
    close_reason          TEXT,
    closed_at             TIMESTAMP WITH TIME ZONE,
    closed_by             VARCHAR(100),
    reopened_at           TIMESTAMP WITH TIME ZONE,
    reopened_by           VARCHAR(100),
    notes                 TEXT,
    is_active             BOOLEAN DEFAULT TRUE,
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profile_active_code 
ON public.tbl_user_profile_mst (user_code) 
WHERE user_status = 'ACTIVE';

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profile_active_emp 
ON public.tbl_user_profile_mst (employee_id) 
WHERE user_status = 'ACTIVE';

-- =============================================================================
-- SECTION 4: 21 PHYSICAL MASTER TABLES
-- =============================================================================

-- 1. Country
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

-- 2. State
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

-- 3. District
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

-- 4. City
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

-- 5. Zone
CREATE TABLE IF NOT EXISTS public.tbl_zone_mst (
    id              SERIAL PRIMARY KEY,
    zone_code       VARCHAR(20) NOT NULL UNIQUE,
    zone_name       VARCHAR(150) NOT NULL UNIQUE,
    description     TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Region
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

-- 7. Area
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

-- 8. Sub-Area
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

-- 9. Branch / Depot
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

-- 10. Warehouse / Hub
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

-- 11. Department
CREATE TABLE IF NOT EXISTS public.tbl_department_mst (
    id              SERIAL PRIMARY KEY,
    dept_code       VARCHAR(20) NOT NULL UNIQUE,
    dept_name       VARCHAR(150) NOT NULL UNIQUE,
    description     TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. Designation
CREATE TABLE IF NOT EXISTS public.tbl_designation_master (
    id                SERIAL PRIMARY KEY,
    designation_code  VARCHAR(20) NOT NULL UNIQUE,
    designation_name  VARCHAR(150) NOT NULL,
    description       TEXT,
    is_active         BOOLEAN DEFAULT TRUE,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. Employee Type
CREATE TABLE IF NOT EXISTS public.tbl_employee_type_mst (
    id              SERIAL PRIMARY KEY,
    type_code       VARCHAR(20) NOT NULL UNIQUE,
    type_name       VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. Employment Status
CREATE TABLE IF NOT EXISTS public.tbl_employment_status_mst (
    id              SERIAL PRIMARY KEY,
    status_code     VARCHAR(20) NOT NULL UNIQUE,
    status_name     VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. Organization Level
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

-- 16. Organization Unit
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

-- 17. Reporting Structure
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

-- 18. Shift Master
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

-- 19. Skill Master
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

-- 20. Document Type
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

-- 21. Employee Master
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

-- =============================================================================
-- SECTION 5: PASSWORD UPDATE QUERY (FOR admin@client001.com)
-- Password: "1" (Bcrypt 10 rounds hash: $2b$10$wiK3TdKAKrozkM4GCJkAV.NJ4bzeKCGIcr0Qw3YuPxPdUMbHkSPIW)
-- =============================================================================

UPDATE public.tbl_user_mst
SET c_password_hash = '$2b$10$wiK3TdKAKrozkM4GCJkAV.NJ4bzeKCGIcr0Qw3YuPxPdUMbHkSPIW',
    c_user_status   = 'ACTIVE',
    b_is_active     = TRUE
WHERE LOWER(c_email) = 'admin@client001.com';



-- =============================================================================
-- SECTION 6: CONTROL PANEL & SETUP MODULE FRAMEWORK
-- =============================================================================

-- 1. Control Module Master
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

-- 2. Control Panel Config
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

-- 3. Options Header & Setup Sub-Menus
INSERT INTO public.tbl_menu_mst_header (header_name, header_code, icon_name, display_order, is_active)
VALUES ('Options', 'options', 'SlidersHorizontal', 5, true)
ON CONFLICT (header_name) DO UPDATE SET
  header_code = EXCLUDED.header_code,
  icon_name = EXCLUDED.icon_name,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

INSERT INTO public.tbl_sub_menu_mst 
  (header_id, sub_menu_name, route_path, icon_name, display_order, is_active, is_sidebar_visible, description)
SELECT h.header_id, 'Setup Module', '/setupmodule', 'Settings', 1, true, false, 'Enterprise Setup & System Configuration Hub'
FROM public.tbl_menu_mst_header h WHERE h.header_name = 'Options'
ON CONFLICT (header_id, sub_menu_name) DO UPDATE SET
  route_path = EXCLUDED.route_path,
  icon_name = EXCLUDED.icon_name,
  display_order = EXCLUDED.display_order,
  is_sidebar_visible = EXCLUDED.is_sidebar_visible,
  description = EXCLUDED.description;

INSERT INTO public.tbl_sub_menu_mst 
  (header_id, sub_menu_name, route_path, icon_name, display_order, is_active, is_sidebar_visible, description)
SELECT h.header_id, 'Control Panel', '/ctrl_panel', 'SlidersHorizontal', 2, true, false, 'Dynamic Module Policies & Operational Control Center'
FROM public.tbl_menu_mst_header h WHERE h.header_name = 'Options'
ON CONFLICT (header_id, sub_menu_name) DO UPDATE SET
  route_path = EXCLUDED.route_path,
  icon_name = EXCLUDED.icon_name,
  display_order = EXCLUDED.display_order,
  is_sidebar_visible = EXCLUDED.is_sidebar_visible,
  description = EXCLUDED.description;


-- =============================================================================
-- SECTION 7: USER THEME STYLE & WORKSPACE PERSONALIZATION
-- Available for ALL users of the application
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tbl_user_theme_preferences (
    id                  SERIAL PRIMARY KEY,
    user_id             UUID NOT NULL REFERENCES public.tbl_user_mst(u_user_id) ON DELETE CASCADE UNIQUE,
    header_color        VARCHAR(20) DEFAULT 'dark',      -- 'dark' | 'light'
    menu_color          VARCHAR(20) DEFAULT 'light',     -- 'dark' | 'light'
    color_mode          VARCHAR(20) DEFAULT 'light',     -- 'dark' | 'light'
    layout              VARCHAR(30) DEFAULT 'sidebar',   -- 'sidebar' | 'top_menu' | 'dual_sidebar' | 'minimal'
    sidebar_width       VARCHAR(20) DEFAULT 'expanded',  -- 'expanded' | 'collapsed'
    font_family         VARCHAR(50) DEFAULT 'Plus Jakarta Sans',
    accent_color        VARCHAR(20) DEFAULT '#187f65',
    custom_settings     JSONB DEFAULT '{}'::jsonb,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed defaults for all existing users
INSERT INTO public.tbl_user_theme_preferences (user_id, header_color, menu_color, color_mode, layout, sidebar_width, font_family, accent_color)
SELECT u.u_user_id, 'dark', 'light', 'light', 'sidebar', 'expanded', 'Plus Jakarta Sans', '#187f65'
FROM public.tbl_user_mst u
ON CONFLICT (user_id) DO NOTHING;

-- Register 'Theme Style' under Options header
INSERT INTO public.tbl_sub_menu_mst 
  (header_id, sub_menu_name, route_path, icon_name, display_order, is_active, is_sidebar_visible, description)
SELECT h.header_id, 'Theme Style', '/theme-style', 'Palette', 3, true, false, 'Personalize workspace layout, header/menu colors, fonts and accents'
FROM public.tbl_menu_mst_header h WHERE h.header_name = 'Options'
ON CONFLICT (header_id, sub_menu_name) DO UPDATE SET
  route_path = EXCLUDED.route_path,
  icon_name = EXCLUDED.icon_name,
  display_order = EXCLUDED.display_order,
  description = EXCLUDED.description;

-- Grant permissions for Theme Style to ALL active roles
INSERT INTO public.tbl_role_menu_mapping (role_id, role_code, sub_menu_id, can_view, can_add, can_edit, can_delete, is_active)
SELECT r.u_role_id, r.c_role_code, sm.sub_menu_id, true, true, true, true, true
FROM public.tbl_sub_menu_mst sm
CROSS JOIN public.tbl_role_mst r
WHERE sm.route_path = '/theme-style'
ON CONFLICT (role_code, sub_menu_id) DO UPDATE SET can_view = true, is_active = true, updated_at = NOW();

-- Grant permissions for Theme Style to all employees
INSERT INTO public.tbl_employee_menu_mapping (employee_id, sub_menu_id, is_granted, can_view, can_add, can_edit, can_delete, is_active)
SELECT e.u_employee_id, sm.sub_menu_id, true, true, true, true, true, true
FROM public.tbl_sub_menu_mst sm
CROSS JOIN public.tbl_employee_mst e
WHERE sm.route_path = '/theme-style'
ON CONFLICT (employee_id, sub_menu_id) DO UPDATE SET is_granted = true, can_view = true, is_active = true, updated_at = NOW();
