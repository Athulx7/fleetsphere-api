import { JwtService } from '../dist/services/jwtService.js';
import { TenantResolver } from '../dist/services/tenantResolver.js';

async function test() {
  const initRes = await TenantResolver.resolveByCompanyCode('CLIENTA');
  const pool = initRes.pool;
  const userRoles = ['ADMIN'];
  const employeeId = null;

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
    LEFT JOIN public.tbl_employee_menu_mapping emm 
      ON sm.sub_menu_id = emm.sub_menu_id 
      AND emm.employee_id = $2 
      AND emm.is_active = TRUE
    WHERE sm.is_active = TRUE 
      AND h.is_active = TRUE
      AND (rmm.mapping_id IS NOT NULL OR emm.is_granted = TRUE)
    ORDER BY h.display_order ASC, sm.display_order ASC;
  `;

  const menuRes = await pool.query(query, [userRoles, employeeId]);

  const categoryMap = new Map();
  for (const row of menuRes.rows) {
    if (!categoryMap.has(row.header_name)) {
      categoryMap.set(row.header_name, {
        category: row.header_name,
        icon: row.header_icon || 'LayoutDashboard',
        items: [],
      });
    }

    categoryMap.get(row.header_name).items.push({
      sub_menu_id: row.sub_menu_id,
      label: row.sub_menu_name,
      sub_menu_name: row.sub_menu_name,
      routes: row.route_path,
      route_path: row.route_path,
      description: row.description || `Manage ${row.sub_menu_name.toLowerCase()} and related operations`,
      icon: row.sub_icon || 'Layers',
      display_order: row.sub_display_order,
      is_sidebar_visible: row.is_sidebar_visible !== false,
    });
  }

  const data = Array.from(categoryMap.values());
  console.log('Main Menu Data Output:');
  console.log(JSON.stringify(data, null, 2));

  console.log('\nChecking sidebar items:');
  const allItems = data.flatMap(m => m.items);
  const sidebarItems = allItems.filter(i => i.is_sidebar_visible);
  console.log(`Total sub-menus: ${allItems.length}`);
  console.log(`Sidebar visible sub-menus: ${sidebarItems.length}`);
  sidebarItems.forEach(i => console.log(` - ${i.label} (order: ${i.display_order})`));

  await pool.end();
}

test().catch(console.error);

