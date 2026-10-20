import dotenv from 'dotenv';

dotenv.config();

export const ENV = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  ADMIN_DATABASE_URL: process.env.ADMIN_DATABASE_URL || 'postgresql://postgres:csq@123@localhost:5432/fleetsphere_admin',
  
  JWT: {
    SECRET: process.env.JWT_SECRET || 'fleetsphere_super_secret_jwt_key_2026_production_grade_random_xyz987',
    EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',
    ISSUER: process.env.JWT_ISSUER || 'fleetsphere-api',
    AUDIENCE: process.env.JWT_AUDIENCE || 'fleetsphere-client',
    ALGORITHM: 'HS256' as const,
  },

  TENANT_DB_DEFAULTS: {
    HOST: process.env.TENANT_DB_DEFAULT_HOST || 'localhost',
    PORT: parseInt(process.env.TENANT_DB_DEFAULT_PORT || '5432', 10),
    USER: process.env.TENANT_DB_DEFAULT_USER || 'postgres',
    PASSWORD: process.env.TENANT_DB_DEFAULT_PASSWORD || 'csq@123',
    MAX_CONNECTIONS: 10,
    IDLE_TIMEOUT_MS: 30000,
    CONNECTION_TIMEOUT_MS: 5000,
  },

  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:4200',
};
