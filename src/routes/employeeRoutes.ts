import { Router } from 'express';
import { EmployeeController } from '../controllers/employeeController.js';
import {
  authenticateToken,
  resolveTenantDatabase,
  requirePermission,
} from '../middleware/authMiddleware.js';

const router = Router();

// Protected employee routes with permission checks
router.get(
  '/',
  authenticateToken,
  resolveTenantDatabase,
  requirePermission('employee.view'),
  EmployeeController.getEmployees
);

router.post(
  '/',
  authenticateToken,
  resolveTenantDatabase,
  requirePermission('employee.create'),
  EmployeeController.createEmployee
);

export default router;
