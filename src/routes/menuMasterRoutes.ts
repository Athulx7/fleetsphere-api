import { Router } from 'express';
import { MenuMasterController } from '../controllers/menuMasterController.js';
import { authenticateToken, resolveTenantDatabase } from '../middleware/authMiddleware.js';

const router = Router();

// Apply auth & tenant resolution to all menu routes
router.use(authenticateToken, resolveTenantDatabase);

// Dynamic Menu Tree for Logged In User
router.get('/user-menu', MenuMasterController.getUserMenuTree);

// Auxiliary lists for mapping
router.get('/roles', MenuMasterController.getRoles);
router.get('/employees', MenuMasterController.getEmployees);
router.get('/designations', MenuMasterController.getDesignations);

// Menu Headers CRUD
router.get('/headers', MenuMasterController.getHeaders);
router.post('/headers', MenuMasterController.createHeader);
router.put('/headers/:headerId', MenuMasterController.updateHeader);
router.delete('/headers/:headerId', MenuMasterController.deleteHeader);

// Sub-Menus CRUD
router.get('/sub-menus', MenuMasterController.getSubMenus);
router.post('/sub-menus', MenuMasterController.createSubMenu);
router.put('/sub-menus/:subMenuId', MenuMasterController.updateSubMenu);
router.delete('/sub-menus/:subMenuId', MenuMasterController.deleteSubMenu);

// Role Menu Mappings
router.get('/mappings/role/:roleCode', MenuMasterController.getRoleMappings);
router.post('/mappings/role', MenuMasterController.saveRoleMappings);

// Employee Menu Mappings
router.get('/mappings/employee/:employeeId', MenuMasterController.getEmployeeMappings);
router.post('/mappings/employee', MenuMasterController.saveEmployeeMappings);

export default router;
