import http from 'http';
import { app } from '../dist/index.js';

async function runTest() {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;

  console.log(`[Test] Server listening on port ${port}`);

  try {
    // 1. Test Login & verify Set-Cookie headers
    console.log('[Test 1] Logging in with admin@client001.com...');
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_code: 'CLIENTA',
        email: 'admin@client001.com',
        password: '1',
      }),
    });

    const loginData = await loginRes.json();
    console.log('Login Response Status:', loginRes.status, 'Success:', loginData.success);

    // Inspect Set-Cookie headers
    const rawCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get('set-cookie')];
    console.log('Set-Cookie headers received:');
    rawCookies.forEach(c => console.log(' ->', c));

    const tokenCookieHeader = rawCookies.find(c => c && c.includes('fleetsphere_token='));
    const loggedInCookieHeader = rawCookies.find(c => c && c.includes('fleetsphere_logged_in='));

    if (!tokenCookieHeader || !tokenCookieHeader.includes('HttpOnly')) {
      throw new Error('FAILED: fleetsphere_token HttpOnly cookie was not set!');
    }
    console.log('✓ Verified: fleetsphere_token is set with HttpOnly!');

    if (!loggedInCookieHeader || loggedInCookieHeader.includes('HttpOnly')) {
      throw new Error('FAILED: fleetsphere_logged_in client-hint cookie was not set properly!');
    }
    console.log('✓ Verified: fleetsphere_logged_in is set as client-accessible cookie!');

    // Extract cookie value for subsequent requests
    const cookieHeader = rawCookies.map(c => c.split(';')[0]).join('; ');
    console.log('Cookie string for requests:', cookieHeader);

    // 2. Test GET /api/auth/me using ONLY the cookie (NO Authorization header!)
    console.log('\n[Test 2] Requesting /api/auth/me using ONLY Cookie (no Bearer header)...');
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      method: 'GET',
      headers: {
        'Cookie': cookieHeader,
      },
    });

    const meData = await meRes.json();
    console.log('GET /auth/me Status:', meRes.status);
    console.log('User verified:', meData.data?.user?.email, 'Company:', meData.data?.company?.name);

    if (meRes.status !== 200 || !meData.success || meData.data?.user?.email !== 'admin@client001.com') {
      throw new Error('FAILED: /api/auth/me did not authenticate via cookie!');
    }
    console.log('✓ Verified: Authenticated via HttpOnly cookie successfully without Bearer header!');

    // 3. Test Logout & verify cookie clearing
    console.log('\n[Test 3] Calling POST /api/auth/logout with cookie...');
    const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        'Cookie': cookieHeader,
      },
    });

    const logoutCookies = logoutRes.headers.getSetCookie ? logoutRes.headers.getSetCookie() : [logoutRes.headers.get('set-cookie')];
    console.log('Logout Set-Cookie headers:');
    logoutCookies.forEach(c => console.log(' ->', c));

    const clearedToken = logoutCookies.find(c => c && c.includes('fleetsphere_token=;') || c.includes('Max-Age=0') || c.includes('Expires=Thu, 01 Jan 1970'));
    if (!clearedToken) {
      throw new Error('FAILED: fleetsphere_token was not cleared on logout!');
    }
    console.log('✓ Verified: Cookie was cleared on logout!');

    console.log('\n=========================================');
    console.log('🎉 ALL COOKIE AUTHENTICATION TESTS PASSED!');
    console.log('=========================================');
    server.close();
    process.exit(0);
  } finally {
    server.close();
  }
}

runTest().catch(err => {
  console.error('Test Error:', err);
  process.exit(1);
});
