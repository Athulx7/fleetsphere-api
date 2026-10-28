import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { EmployeeController } from '../controllers/employeeController.js';
import { DynamicMasterController } from '../controllers/dynamicMasterController.js';
import { MenuMasterController } from '../controllers/menuMasterController.js';
import {
  authenticateToken,
  resolveTenantDatabase,
  requirePermission,
} from '../middleware/authMiddleware.js';

const router = Router();

// ============================================================================
// 1. Authentication Routes (/api/auth)
// ============================================================================
router.post('/auth/login', AuthController.login);
router.post('/auth/logout', AuthController.logout);
router.get(
  '/auth/me',
  authenticateToken,
  resolveTenantDatabase,
  AuthController.getMe
);

// ============================================================================
// 2. Employee Routes (/api/employees)
// ============================================================================
router.get(
  '/employees',
  authenticateToken,
  resolveTenantDatabase,
  requirePermission('employee.view'),
  EmployeeController.getEmployees
);

router.post(
  '/employees',
  authenticateToken,
  resolveTenantDatabase,
  requirePermission('employee.create'),
  EmployeeController.createEmployee
);

// ============================================================================
// 3. Dynamic Master Routes (/api/dynamic-master)
// ============================================================================
// Metadata & Schema
router.get(
  '/dynamic-master/:masterCode/metadata',
  authenticateToken,
  resolveTenantDatabase,
  DynamicMasterController.getMetadata
);

// Dropdown Options Lookup
router.get(
  '/dynamic-master/:masterCode/dropdown/:columnName',
  authenticateToken,
  resolveTenantDatabase,
  DynamicMasterController.getDropdownOptions
);

// Next Auto Code
router.get(
  '/dynamic-master/:masterCode/next-code/:columnName',
  authenticateToken,
  resolveTenantDatabase,
  DynamicMasterController.getNextCode
);

// Master CRUD
router.get(
  '/dynamic-master/:masterCode',
  authenticateToken,
  resolveTenantDatabase,
  DynamicMasterController.getList
);

router.get(
  '/dynamic-master/:masterCode/:id',
  authenticateToken,
  resolveTenantDatabase,
  DynamicMasterController.getRecordById
);

router.post(
  '/dynamic-master/:masterCode',
  authenticateToken,
  resolveTenantDatabase,
  DynamicMasterController.createRecord
);

router.put(
  '/dynamic-master/:masterCode/:id',
  authenticateToken,
  resolveTenantDatabase,
  DynamicMasterController.updateRecord
);

router.delete(
  '/dynamic-master/:masterCode/:id',
  authenticateToken,
  resolveTenantDatabase,
  DynamicMasterController.deleteRecord
);

// ============================================================================
// 4. Menu Master & Access Mapping Routes (/api/menus)
// ============================================================================
// Dynamic User Menu Tree
router.get(
  '/menus/user-menu',
  authenticateToken,
  resolveTenantDatabase,
  MenuMasterController.getUserMenuTree
);

// Auxiliary lists for mapping
router.get(
  '/menus/roles',
  authenticateToken,
  resolveTenantDatabase,
  MenuMasterController.getRoles
);

router.get(
  '/menus/employees',
  authenticateToken,
  resolveTenantDatabase,
  MenuMasterController.getEmployees
);

router.get(
  '/menus/designations',
  authenticateToken,
  resolveTenantDatabase,
  MenuMasterController.getDesignations
);

// Menu Headers CRUD
router.get(
  '/menus/headers',
  authenticateToken,
  resolveTenantDatabase,
  MenuMasterController.getHeaders
);

router.post(
  '/menus/headers',
  authenticateToken,
  resolveTenantDatabase,
  MenuMasterController.createHeader
);

router.put(
  '/menus/headers/:headerId',
  authenticateToken,
  resolveTenantDatabase,
  MenuMasterController.updateHeader
);

router.delete(
  '/menus/headers/:headerId',
  authenticateToken,
  resolveTenantDatabase,
  MenuMasterController.deleteHeader
);

// Sub-Menus CRUD
router.get(
  '/menus/sub-menus',
  authenticateToken,
  resolveTenantDatabase,
  MenuMasterController.getSubMenus
);

router.post(
  '/menus/sub-menus',
  authenticateToken,
  resolveTenantDatabase,
  MenuMasterController.createSubMenu
);

router.put(
  '/menus/sub-menus/:subMenuId',
  authenticateToken,
  resolveTenantDatabase,
  MenuMasterController.updateSubMenu
);

router.delete(
  '/menus/sub-menus/:subMenuId',
  authenticateToken,
  resolveTenantDatabase,
  MenuMasterController.deleteSubMenu
);

// Role Menu Mappings
router.get(
  '/menus/mappings/role/:roleCode',
  authenticateToken,
  resolveTenantDatabase,
  MenuMasterController.getRoleMappings
);

router.post(
  '/menus/mappings/role',
  authenticateToken,
  resolveTenantDatabase,
  MenuMasterController.saveRoleMappings
);

// Employee Menu Mappings
router.get(
  '/menus/mappings/employee/:employeeId',
  authenticateToken,
  resolveTenantDatabase,
  MenuMasterController.getEmployeeMappings
);

router.post(
  '/menus/mappings/employee',
  authenticateToken,
  resolveTenantDatabase,
  MenuMasterController.saveEmployeeMappings
);

export default router;
