import type pg from 'pg';

export interface DesignationClaim {
  id: string;
  code: string;
  name: string;
}

export interface JwtUserPayload {
  sub: string;
  company_id: string;
  company_code: string;
  email: string;
  employee_id?: string | null;
  designation?: DesignationClaim | null;
  roles: string[];
  permissions: string[];
  jti?: string;
  iss?: string;
  aud?: string;
  iat?: number;
  exp?: number;
}

export interface CompanyRecord {
  u_company_id: string;
  c_company_code: string;
  c_company_name: string;
  c_status: string;
  b_is_active: boolean;
}

export interface SubscriptionRecord {
  u_subscription_id: string;
  u_company_id: string;
  u_plan_id: string;
  c_subscription_status: string;
  d_start_date: string;
  d_end_date: string | null;
  d_trial_end_date: string | null;
  b_is_active: boolean;
  c_plan_code?: string;
  c_plan_name?: string;
}

export interface TenantDatabaseConfigRecord {
  u_database_config_id: string;
  u_company_id: string;
  c_database_name: string;
  c_database_host: string;
  n_database_port: number;
  c_database_schema: string;
  c_database_mode: string;
  c_ssl_mode: string;
  c_secret_reference: string;
  c_provisioning_status: string;
  b_is_active: boolean;
}

export interface TenantResolvedInfo {
  company: CompanyRecord;
  subscription: SubscriptionRecord;
  dbConfig: TenantDatabaseConfigRecord;
}

export interface TenantContext {
  user: {
    userId: string;
    email: string;
    employeeId?: string | null;
    designation?: DesignationClaim | null;
    roles: string[];
    permissions: string[];
  };
  tenant: {
    companyId: string;
    companyCode: string;
    companyName: string;
    databaseName: string;
  };
  db: pg.Pool;
}

export interface LoginRequestBody {
  company_code: string;
  email: string;
  password: string;
}

export interface LoginResponseData {
  token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: string;
    email: string;
    employee_id?: string | null;
    designation?: DesignationClaim | null;
    roles: string[];
    permissions: string[];
  };
  company: {
    id: string;
    code: string;
    name: string;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
