import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { adminPool, testAdminDbConnection } from './config/adminDb.js';
import { TenantPoolManager } from './services/tenantPoolManager.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import { ENV } from './config/env.js';

dotenv.config();

export const app = express();
const PORT = ENV.PORT;

// Middleware
app.use(
  cors({
    origin: [ENV.CORS_ORIGIN, 'http://localhost:4200'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json());

// Public health check routes
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'FleetSphere Multi-Tenant API is running.' });
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    activeTenantPools: TenantPoolManager.getActivePoolCount(),
    timestamp: new Date().toISOString(),
  });
});

// Admin Database Health Check endpoint
app.get('/api/admin/db-health', async (req: Request, res: Response) => {
  const result = await testAdminDbConnection();
  if (result.success) {
    res.json({
      status: 'connected',
      database: result.database,
      serverTime: result.serverTime,
    });
  } else {
    res.status(500).json({
      status: 'error',
      message: 'Failed to connect to Admin PostgreSQL database',
      error: result.error,
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);

// Global Error Handler
app.use(errorHandler);

let server: ReturnType<typeof app.listen> | null = null;

if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, async () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    await testAdminDbConnection();
  });
}

// Graceful shutdown closing admin DB pool and all active tenant pools
const shutdown = async () => {
  console.log('\nShutting down server gracefully...');
  const closeServer = () =>
    new Promise<void>((resolve) => {
      if (server) {
        server.close(() => resolve());
      } else {
        resolve();
      }
    });

  try {
    await closeServer();
    await adminPool.end();
    console.log('[Admin DB] Connection pool closed.');
    await TenantPoolManager.closeAll();
    console.log('[Tenant Pool Manager] All tenant pools closed.');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);