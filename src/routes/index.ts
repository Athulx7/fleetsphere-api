import { Router } from 'express';
import authRoutes from './authRoutes.js';
import employeeRoutes from './employeeRoutes.js';
import dynamicMasterRoutes from './dynamicMasterRoutes.js';
import menuRoutes from './menuMasterRoutes.js';

const apiRouter = Router();

// Aggregate all module routes under /api
apiRouter.use('/auth', authRoutes);
apiRouter.use('/employees', employeeRoutes);
apiRouter.use('/dynamic-master', dynamicMasterRoutes);
apiRouter.use('/menus', menuRoutes);

export default apiRouter;
