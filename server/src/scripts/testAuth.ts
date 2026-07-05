/**
 * Phase 3 smoke test — drives the real Express app (register/login/refresh/
 * logout/forgot/reset/change-password) over HTTP against an isolated test DB,
 * plus a direct unit check of the `authorize` RBAC middleware. Run with:
 *   npm run test:auth --workspace server
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import type { AddressInfo } from 'node:net';
import { createApp } from '../app.js';
import { UserModel } from '../models/user.model.js';
import { authorize } from '../middleware/auth.js';
import { ApiError } from '../utils/ApiError.js';

dotenv.config();

const TEST_URI =
  process.env.MONGO_TEST_URI ??
  (process.env.MONGO_URI
    ? process.env.MONGO_URI.replace(/\/[^/]+$/, '/cpms_test')
    : 'mongodb://127.0.0.1:27017/cpms_test');

let passed = 0;
let failed = 0;

function check(label: string, condition: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

/** Extracts the raw value of a cookie by name from a Set-Cookie header list. */
function extractCookie(setCookieHeaders: string[], name: string): string | undefined {
  for (const header of setCookieHeaders) {
    const match = header.match(new RegExp(`${name}=([^;]+)`));
    if (match) return `${name}=${match[1]}`;
  }
  return undefined;
}

/** Test-only helper: response bodies are opaque `unknown` from `fetch`; this
 * repo's error/success envelope is loose enough that a plain index type is
 * more useful here than re-declaring every endpoint's response shape. */
interface JsonBody {
  success: boolean;
  message?: string;
  details?: unknown[];
  data?: Record<string, any>;
}

async function json(res: Response): Promise<JsonBody> {
  return (await res.json()) as JsonBody;
}

async function run(): Promise<void> {
  console.log(`\nConnecting to test DB: ${TEST_URI}`);
  await mongoose.connect(TEST_URI);
  await mongoose.connection.dropDatabase();
  console.log('Test DB reset.\n');

  const app = createApp();
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}/api/v1/auth`;

  const credentials = { name: 'Ada Auth', email: 'ada@cpms.test', password: 'supersecret123' };

  // 1. Register
  console.log('Register');
  const registerRes = await fetch(`${base}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  const registerBody = await json(registerRes);
  check('Register returns 201', registerRes.status === 201);
  check('Register returns an access token', typeof registerBody.data?.accessToken === 'string');
  check(
    'Registered user defaults to site_engineer role (role field ignored on input)',
    registerBody.data?.user?.role === 'site_engineer',
  );
  check('Register response never includes password', registerBody.data?.user?.password === undefined);

  const setCookies = registerRes.headers.getSetCookie?.() ?? [];
  const refreshCookie = extractCookie(setCookies, 'refreshToken');
  check('Register sets an httpOnly refreshToken cookie', Boolean(refreshCookie));

  const storedUser = await UserModel.findOne({ email: credentials.email }).select('+password');
  check('Password is hashed at rest (bcrypt prefix)', storedUser?.password.startsWith('$2') ?? false);
  check('Password hash differs from the plaintext', storedUser?.password !== credentials.password);

  // 2. Duplicate registration is rejected
  console.log('\nDuplicate registration');
  const dupRes = await fetch(`${base}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  check('Duplicate email registration returns 409', dupRes.status === 409);

  // 3. Validation
  console.log('\nInput validation');
  const badRegisterRes = await fetch(`${base}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'A', email: 'not-an-email', password: '123' }),
  });
  const badRegisterBody = await json(badRegisterRes);
  check('Invalid registration payload returns 400', badRegisterRes.status === 400);
  check('Validation error lists field-level details', Array.isArray(badRegisterBody.details) && badRegisterBody.details.length > 0);

  // 4. Login with wrong password
  console.log('\nLogin');
  const wrongLoginRes = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: credentials.email, password: 'wrong-password' }),
  });
  check('Login with wrong password returns 401', wrongLoginRes.status === 401);

  const loginRes = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: credentials.email, password: credentials.password }),
  });
  const loginBody = await json(loginRes);
  check('Login with correct credentials returns 200', loginRes.status === 200);
  const accessToken = loginBody.data?.accessToken as string | undefined;
  check('Login returns an access token', typeof accessToken === 'string');

  const loginSetCookies = loginRes.headers.getSetCookie?.() ?? [];
  const loginRefreshCookie = extractCookie(loginSetCookies, 'refreshToken');
  check('Login sets a refreshToken cookie', Boolean(loginRefreshCookie));

  // 5. Protected route without a token
  console.log('\nAuthenticated routes');
  const meNoAuthRes = await fetch(`${base}/me`);
  check('GET /me without a token returns 401', meNoAuthRes.status === 401);

  const meRes = await fetch(`${base}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const meBody = await json(meRes);
  check('GET /me with a valid token returns 200', meRes.status === 200);
  check('GET /me returns the logged-in user', meBody.data?.user?.email === credentials.email);

  const meBadTokenRes = await fetch(`${base}/me`, {
    headers: { Authorization: 'Bearer not-a-real-token' },
  });
  check('GET /me with a malformed token returns 401', meBadTokenRes.status === 401);

  // 6. Refresh token flow
  console.log('\nRefresh token rotation');
  const refreshRes = await fetch(`${base}/refresh`, {
    method: 'POST',
    headers: { Cookie: loginRefreshCookie ?? '' },
  });
  const refreshBody = await json(refreshRes);
  check('POST /refresh with valid cookie returns 200', refreshRes.status === 200);
  check('Refresh issues a new access token', typeof refreshBody.data?.accessToken === 'string');
  check(
    'Refreshed access token differs from the original (rotation)',
    refreshBody.data?.accessToken !== accessToken,
  );

  const refreshNoCookieRes = await fetch(`${base}/refresh`, { method: 'POST' });
  check('POST /refresh without a cookie returns 401', refreshNoCookieRes.status === 401);

  // 7. Change password (requires current password)
  console.log('\nChange password');
  const newAccessToken = refreshBody.data?.accessToken as string;
  const wrongChangeRes = await fetch(`${base}/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${newAccessToken}` },
    body: JSON.stringify({ currentPassword: 'wrong', newPassword: 'brandnewpassword123' }),
  });
  check('Change password with wrong current password returns 401', wrongChangeRes.status === 401);

  const changeRes = await fetch(`${base}/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${newAccessToken}` },
    body: JSON.stringify({ currentPassword: credentials.password, newPassword: 'brandnewpassword123' }),
  });
  check('Change password with correct current password returns 200', changeRes.status === 200);

  const oldPasswordLoginRes = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: credentials.email, password: credentials.password }),
  });
  check('Login with the old password now fails', oldPasswordLoginRes.status === 401);

  const newPasswordLoginRes = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: credentials.email, password: 'brandnewpassword123' }),
  });
  check('Login with the new password succeeds', newPasswordLoginRes.status === 200);

  // 8. Forgot / reset password
  console.log('\nForgot & reset password');
  const forgotRes = await fetch(`${base}/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: credentials.email }),
  });
  const forgotBody = await json(forgotRes);
  check('Forgot-password returns 200 for a known email', forgotRes.status === 200);
  const resetToken = forgotBody.data?.resetToken as string | undefined;
  check('Forgot-password (dev mode) returns a reset token', typeof resetToken === 'string');

  const forgotUnknownRes = await fetch(`${base}/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nobody@cpms.test' }),
  });
  check('Forgot-password also returns 200 for an unknown email (no enumeration)', forgotUnknownRes.status === 200);

  const badResetRes = await fetch(`${base}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'not-a-real-token', password: 'anotherpassword123' }),
  });
  check('Reset-password with an invalid token returns 400', badResetRes.status === 400);

  const resetRes = await fetch(`${base}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: resetToken, password: 'resetpassword123' }),
  });
  check('Reset-password with a valid token returns 200', resetRes.status === 200);

  const postResetLoginRes = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: credentials.email, password: 'resetpassword123' }),
  });
  check('Login with the reset password succeeds', postResetLoginRes.status === 200);
  const postResetLoginBody = await json(postResetLoginRes);

  // 9. Logout invalidates the refresh token
  console.log('\nLogout');
  const finalAccessToken = postResetLoginBody.data?.accessToken as string;
  const finalSetCookies = postResetLoginRes.headers.getSetCookie?.() ?? [];
  const finalRefreshCookie = extractCookie(finalSetCookies, 'refreshToken');

  const logoutRes = await fetch(`${base}/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${finalAccessToken}` },
  });
  check('Logout returns 200', logoutRes.status === 200);

  const refreshAfterLogoutRes = await fetch(`${base}/refresh`, {
    method: 'POST',
    headers: { Cookie: finalRefreshCookie ?? '' },
  });
  check('Refresh token is invalidated after logout', refreshAfterLogoutRes.status === 401);

  // 10. RBAC middleware — direct unit check (no protected business route exists yet)
  console.log('\nRBAC middleware (authorize)');
  function runAuthorize(role: string | undefined, allowed: readonly string[]): number {
    let statusCode = 200;
    const req = role ? { user: { id: 'x', role } } : ({} as { user?: unknown });
    const next = (err?: unknown) => {
      if (err instanceof ApiError) statusCode = err.statusCode;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    authorize(...(allowed as any))(req as any, {} as any, next);
    return statusCode;
  }
  check(
    'authorize() allows a role in the allow-list',
    runAuthorize('project_manager', ['super_admin', 'project_manager']) === 200,
  );
  check(
    'authorize() rejects a role not in the allow-list with 403',
    runAuthorize('site_engineer', ['super_admin', 'project_manager']) === 403,
  );
  check('authorize() rejects a missing req.user with 401', runAuthorize(undefined, ['super_admin']) === 401);

  // Cleanup
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  console.log(`\n${'='.repeat(40)}`);
  console.log(`Phase 3 auth test: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(40));

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('\nTest run crashed:', err);
  process.exit(1);
});
