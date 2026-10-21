import { Router } from 'express';
import { DynamicMasterController } from '../controllers/dynamicMasterController.js';
import { authenticateToken, resolveTenantDatabase } from '../middleware/authMiddleware.js';

const router = Router();

// Apply auth & tenant resolution to all dynamic master routes
router.use(authenticateToken, resolveTenantDatabase);

// Metadata & Schema
router.get('/:masterCode/metadata', DynamicMasterController.getMetadata);

// Dropdown Options Lookup
router.get('/:masterCode/dropdown/:columnName', DynamicMasterController.getDropdownOptions);

// Next Auto Code
router.get('/:masterCode/next-code/:columnName', DynamicMasterController.getNextCode);

// Master CRUD
router.get('/:masterCode', DynamicMasterController.getList);
router.get('/:masterCode/:id', DynamicMasterController.getRecordById);
router.post('/:masterCode', DynamicMasterController.createRecord);
router.put('/:masterCode/:id', DynamicMasterController.updateRecord);
router.delete('/:masterCode/:id', DynamicMasterController.deleteRecord);

export default router;
