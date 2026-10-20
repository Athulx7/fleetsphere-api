import process from 'node:process';
process.env.NODE_ENV = 'test';

import { app } from './index.js';
import { adminPool } from './config/adminDb.js';
import { TenantPoolManager } from './services/tenantPoolManager.js';
import { JwtService } from './services/jwtService.js';
import { SecretManager } from './services/secretManager.js';
import { TenantResolver } from './services/tenantResolver.js';
import jwt from 'jsonwebtoken';
import { ENV } from './config/env.js';

let serverInstance: any;
const TEST_PORT = 5005;
const BASE_URL = `http://localhost:${TEST_PORT}`;

async function testSuite() {
  console.log('================================================================');
  console.log('       FLEETSPHERE JWT & MULTI-TENANT TEST SUITE');
  console.log('================================================================\n');

  // Start HTTP server on test port
  await new Promise<void>((resolve) => {
    serverInstance = app.listen(TEST_PORT, () => {
      console.log(`[Test Server] Running on ${BASE_URL}\n`);
      resolve();
    });
  });

  let passedCount = 0;
  let failedCount = 0;

  // Clean any test artifacts from previous runs
  try {
    const initRes = await TenantResolver.resolveByCompanyCode('CLIENTA');
    await initRes.pool.query(
      "DELETE FROM tbl_employee_mst WHERE c_employee_code LIKE 'EMP-%' AND c_employee_code != 'ADM001';"
    );
  } catch {}

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`[FAIL] ${testName} ${detail ? '--> ' + detail : ''}`);
      failedCount++;
    }
  }

  let clientAToken = '';
  let clientBToken = '';

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Successful Client Admin login
    // -------------------------------------------------------------------------
    console.log('--- Test 1: Successful Client Admin login ---');
    const res1 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_code: 'CLIENTA',
        email: 'admin@client001.com',
        password: 'Admin@123',
      }),
    });
    const body1 = (await res1.json()) as any;
    assert(res1.status === 200, 'Test 1.1: HTTP 200 on valid login');
    assert(body1.success === true, 'Test 1.2: Response success flag is true');
    assert(typeof body1.data?.token === 'string', 'Test 1.3: Returns signed JWT token');
    assert(body1.data?.user?.email === 'admin@client001.com', 'Test 1.4: User email matches');
    assert(body1.data?.user?.roles?.includes('ADMIN'), 'Test 1.5: User has ADMIN role');
    assert(
      body1.data?.user?.permissions?.includes('employee.view'),
      'Test 1.6: User has employee.view permission'
    );
    assert(body1.data?.company?.code === 'CLIENTA', 'Test 1.7: Company code matches');
    assert(
      body1.data?.user?.designation?.name === 'Client Administrator',
      'Test 1.8: Designation name matches'
    );
    clientAToken = body1.data?.token;

    // Verify token claims
    const decoded1 = JwtService.verifyToken(clientAToken);
    assert(decoded1.company_code === 'CLIENTA', 'Test 1.9: JWT contains company_code');
    assert(decoded1.iss === 'fleetsphere-api', 'Test 1.10: JWT issuer matches');
    assert(decoded1.aud === 'fleetsphere-client', 'Test 1.11: JWT audience matches');
    assert(typeof decoded1.jti === 'string', 'Test 1.12: JWT contains unique jti');

    // Also login as CLIENTB for subsequent tests
    const resB = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_code: 'CLIENTB',
        email: 'admin@clientb.com',
        password: 'Admin@123',
      }),
    });
    const bodyB = (await resB.json()) as any;
    clientBToken = bodyB.data?.token;
    assert(resB.status === 200, 'Test 1.13: CLIENTB login succeeds');

    // -------------------------------------------------------------------------
    // TEST 2: Incorrect password
    // -------------------------------------------------------------------------
    console.log('\n--- Test 2: Incorrect password ---');
    const res2 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_code: 'CLIENTA',
        email: 'admin@client001.com',
        password: 'WrongPassword@999',
      }),
    });
    const body2 = (await res2.json()) as any;
    assert(res2.status === 401, 'Test 2.1: HTTP 401 on incorrect password');
    assert(body2.success === false, 'Test 2.2: success flag is false');
    assert(body2.message.includes('Invalid email or password'), 'Test 2.3: Generic invalid credentials message');

    // -------------------------------------------------------------------------
    // TEST 3: Invalid or expired JWT
    // -------------------------------------------------------------------------
    console.log('\n--- Test 3: Invalid or expired JWT ---');
    // 3a. Invalid token signature
    const res3a = await fetch(`${BASE_URL}/api/employees`, {
      headers: { Authorization: 'Bearer this.is.an.invalid.token' },
    });
    assert(res3a.status === 401, 'Test 3.1: HTTP 401 on malformed/invalid token');

    // 3b. Expired token
    const expiredToken = jwt.sign(
      {
        sub: decoded1.sub,
        company_id: decoded1.company_id,
        company_code: decoded1.company_code,
        email: decoded1.email,
        roles: ['ADMIN'],
        permissions: ['employee.view'],
      },
      ENV.JWT.SECRET,
      {
        algorithm: 'HS256',
        expiresIn: '-10s', // expired 10 seconds ago
        issuer: ENV.JWT.ISSUER,
        audience: ENV.JWT.AUDIENCE,
      }
    );
    const res3b = await fetch(`${BASE_URL}/api/employees`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    const body3b = (await res3b.json()) as any;
    assert(res3b.status === 401, 'Test 3.2: HTTP 401 on expired token');
    assert(body3b.message.includes('expired'), 'Test 3.3: Error message identifies expired token');

    // -------------------------------------------------------------------------
    // TEST 4: Inactive company or user
    // -------------------------------------------------------------------------
    console.log('\n--- Test 4: Inactive company or user ---');
    // Create inactive user token
    const fakeInactiveUserId = '00000000-0000-0000-0000-000000000000';
    const inactiveUserToken = jwt.sign(
      {
        sub: fakeInactiveUserId,
        company_id: decoded1.company_id,
        company_code: decoded1.company_code,
        email: 'inactive@client001.com',
        roles: ['ADMIN'],
        permissions: ['employee.view'],
      },
      ENV.JWT.SECRET,
      { algorithm: 'HS256', expiresIn: '1h', issuer: ENV.JWT.ISSUER, audience: ENV.JWT.AUDIENCE }
    );
    const res4 = await fetch(`${BASE_URL}/api/employees`, {
      headers: { Authorization: `Bearer ${inactiveUserToken}` },
    });
    assert(res4.status === 401, 'Test 4.1: HTTP 401 for non-existent or inactive user');

    // Test inactive company in login
    const res4b = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_code: 'NON_EXISTENT_COMPANY',
        email: 'admin@client001.com',
        password: 'Admin@123',
      }),
    });
    assert(res4b.status === 401, 'Test 4.2: HTTP 401 for inactive/non-existent company');

    // -------------------------------------------------------------------------
    // TEST 5: Expired subscription
    // -------------------------------------------------------------------------
    console.log('\n--- Test 5: Expired subscription ---');
    TenantResolver.invalidateCache();
    // Set both start_date and end_date in the past to respect chk_subscription_dates (end >= start)
    await adminPool.query(
      `
      UPDATE tbl_tenant_subscriptions
      SET d_start_date = CURRENT_DATE - INTERVAL '30 days',
          d_end_date = CURRENT_DATE - INTERVAL '2 days'
      WHERE u_company_id = $1;
    `,
      [decoded1.company_id]
    );

    TenantResolver.invalidateCache();
    const res5 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_code: 'CLIENTA',
        email: 'admin@client001.com',
        password: 'Admin@123',
      }),
    });
    const body5 = (await res5.json()) as any;
    assert(res5.status === 403, 'Test 5.1: HTTP 403 when subscription is expired');
    assert(
      body5.message.includes('expired'),
      'Test 5.2: Error message explicitly mentions subscription expired'
    );

    // Restore subscription dates
    await adminPool.query(
      `
      UPDATE tbl_tenant_subscriptions
      SET d_start_date = CURRENT_DATE - INTERVAL '1 day',
          d_end_date = CURRENT_DATE + INTERVAL '30 days'
      WHERE u_company_id = $1;
    `,
      [decoded1.company_id]
    );
    TenantResolver.invalidateCache();

    // -------------------------------------------------------------------------
    // TEST 6: Tenant configuration not ready
    // -------------------------------------------------------------------------
    console.log('\n--- Test 6: Tenant configuration not ready ---');
    TenantResolver.invalidateCache();
    await adminPool.query(
      `
      UPDATE tbl_tenant_database_config
      SET c_provisioning_status = 'provisioning'
      WHERE u_company_id = $1;
    `,
      [decoded1.company_id]
    );

    TenantResolver.invalidateCache();
    const res6 = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_code: 'CLIENTA',
        email: 'admin@client001.com',
        password: 'Admin@123',
      }),
    });
    assert(res6.status === 500, 'Test 6.1: HTTP 500 when DB provisioning status is not READY');

    // Restore provisioning status
    await adminPool.query(
      `
      UPDATE tbl_tenant_database_config
      SET c_provisioning_status = 'ready'
      WHERE u_company_id = $1;
    `,
      [decoded1.company_id]
    );
    TenantResolver.invalidateCache();

    // -------------------------------------------------------------------------
    // TEST 7: Missing secret mapping
    // -------------------------------------------------------------------------
    console.log('\n--- Test 7: Missing secret mapping ---');
    let secretThrown = false;
    try {
      SecretManager.resolveSecret('');
    } catch {
      secretThrown = true;
    }
    assert(secretThrown, 'Test 7.1: SecretManager throws when secret reference is empty');

    // -------------------------------------------------------------------------
    // TEST 8: User without the required permission
    // -------------------------------------------------------------------------
    console.log('\n--- Test 8: User without the required permission ---');
    // POST /api/employees requires 'employee.create'
    // Client B only has 'employee.view', so Client B will be rejected with HTTP 403 Forbidden!
    const res8 = await fetch(`${BASE_URL}/api/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clientBToken}`,
      },
      body: JSON.stringify({
        employee_code: 'NEW001',
        first_name: 'Unauthorized',
      }),
    });
    const body8 = (await res8.json()) as any;
    assert(res8.status === 403, 'Test 8.1: HTTP 403 Forbidden when user lacks required permission');
    assert(
      body8.message.includes('employee.create'),
      'Test 8.2: Error message cites missing permission employee.create'
    );

    // Client A DOES have 'employee.create', so Client A succeeds!
    const uniqueCode = `EMP-TEST-${Date.now().toString().slice(-6)}`;
    const res8b = await fetch(`${BASE_URL}/api/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clientAToken}`,
      },
      body: JSON.stringify({
        employee_code: uniqueCode,
        first_name: 'Authorized',
      }),
    });
    const body8b = (await res8b.json()) as any;
    assert(res8b.status === 201, 'Test 8.3: HTTP 201 when user has required employee.create permission');

    // Clean up created test employee
    if (body8b.data?.u_employee_id) {
      const clientAPool = await TenantResolver.resolveByCompanyCode('CLIENTA');
      await clientAPool.pool.query('DELETE FROM tbl_employee_mst WHERE u_employee_id = $1;', [
        body8b.data.u_employee_id,
      ]);
    }

    // -------------------------------------------------------------------------
    // TEST 9: Two different clients making simultaneous requests
    // -------------------------------------------------------------------------
    console.log('\n--- Test 9: Two different clients making simultaneous requests ---');
    const [simA, simB] = await Promise.all([
      fetch(`${BASE_URL}/api/employees`, {
        headers: { Authorization: `Bearer ${clientAToken}` },
      }),
      fetch(`${BASE_URL}/api/employees`, {
        headers: { Authorization: `Bearer ${clientBToken}` },
      }),
    ]);
    const simABody = (await simA.json()) as any;
    const simBBody = (await simB.json()) as any;

    assert(simA.status === 200, 'Test 9.1: Client A request succeeds');
    assert(simB.status === 200, 'Test 9.2: Client B request succeeds');
    assert(
      simABody.data.tenant.company_code === 'CLIENTA',
      'Test 9.3: Client A routed to CLIENTA data'
    );
    assert(
      simBBody.data.tenant.company_code === 'CLIENTB',
      'Test 9.4: Client B routed to CLIENTB data'
    );
    assert(
      simABody.data.employees.some((e: any) => e.first_name === 'Client'),
      'Test 9.5: Client A employee includes Client Administrator'
    );
    assert(
      simBBody.data.employees.some((e: any) => e.first_name === 'TenantB'),
      'Test 9.6: Client B employee includes TenantB Manager'
    );

    // -------------------------------------------------------------------------
    // TEST 10: Attempts to access another tenant's data
    // -------------------------------------------------------------------------
    console.log("\n--- Test 10: Attempts to access another tenant's data ---");
    // What happens if Client A modifies query/params or tries to claim CLIENTB?
    // Token has company_id for CLIENTA. If someone alters the token claims, signature fails (401).
    const tamperedToken = clientAToken.slice(0, -6) + 'abc123';
    const res10a = await fetch(`${BASE_URL}/api/employees`, {
      headers: { Authorization: `Bearer ${tamperedToken}` },
    });
    assert(res10a.status === 401, 'Test 10.1: Tampered token signature fails');

    // Token with mismatched company_id and company_code
    const forgedToken = jwt.sign(
      {
        sub: decoded1.sub,
        company_id: decoded1.company_id, // CLIENTA ID
        company_code: 'CLIENTB', // Forged CLIENTB code
        email: decoded1.email,
        roles: ['ADMIN'],
        permissions: ['employee.view'],
      },
      ENV.JWT.SECRET,
      { algorithm: 'HS256', expiresIn: '1h', issuer: ENV.JWT.ISSUER, audience: ENV.JWT.AUDIENCE }
    );
    TenantResolver.invalidateCache();
    const res10b = await fetch(`${BASE_URL}/api/employees`, {
      headers: { Authorization: `Bearer ${forgedToken}` },
    });
    assert(res10b.status === 500 || res10b.status === 401, 'Test 10.2: Forged company identity rejected');

    // -------------------------------------------------------------------------
    // TEST 11: Logout and expired-token behavior
    // -------------------------------------------------------------------------
    console.log('\n--- Test 11: Logout and expired-token behavior ---');
    const res11 = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clientAToken}`,
      },
    });
    const body11 = (await res11.json()) as any;
    assert(res11.status === 200, 'Test 11.1: Logout returns HTTP 200');
    assert(body11.success === true, 'Test 11.2: Logout response success is true');

    // -------------------------------------------------------------------------
    // TEST 12: Database connection failures
    // -------------------------------------------------------------------------
    console.log('\n--- Test 12: Database connection failures ---');
    let badPoolFailed = false;
    try {
      await TenantPoolManager.getPool(
        {
          u_database_config_id: 'bad-id',
          u_company_id: 'bad-comp-id',
          c_database_name: 'non_existent_database_xyz999',
          c_database_host: 'localhost',
          n_database_port: 5432,
          c_database_schema: 'public',
          c_database_mode: 'database_per_tenant',
          c_ssl_mode: 'disable',
          c_secret_reference: 'NONE',
          c_provisioning_status: 'ready',
          b_is_active: true,
        },
        { user: 'postgres', password: 'csq@123' }
      );
    } catch {
      badPoolFailed = true;
    }
    assert(badPoolFailed, 'Test 12.1: TenantPoolManager gracefully fails and rejects on unreachable database');

    console.log('\n================================================================');
    console.log(`TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('================================================================\n');
  } catch (err) {
    console.error('Unexpected test suite crash:', err);
  } finally {
    if (serverInstance) {
      serverInstance.close();
    }
    await adminPool.end();
    await TenantPoolManager.closeAll();
    process.exit(failedCount === 0 ? 0 : 1);
  }
}

testSuite();
