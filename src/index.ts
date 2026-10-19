import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { adminPool, testAdminDbConnection } from './config/adminDb.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Hello from FleetSphere API!' });
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

const server = app.listen(PORT, async () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  // Test connection to Admin DB on startup
  await testAdminDbConnection();
});

// Graceful shutdown
const shutdown = async () => {
  console.log('\nShutting down server gracefully...');
  server.close(async () => {
    await adminPool.end();
    console.log('[Admin DB] Connection pool closed.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);