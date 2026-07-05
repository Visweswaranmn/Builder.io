/**
 * Phase 5 smoke test — drives the real Express app's /projects CRUD endpoints
 * over HTTP, covering RBAC per role, validation, pagination/filtering, and
 * 404/400 edge cases. Run with:
 *   npm run test:projects --workspace server
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import type { AddressInfo } from 'node:net';
import { createApp } from '../app.js';
import { UserModel } from '../models/user.model.js';
import type { UserRole } from '../constants/enums.js';

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
  const authBase = `http://127.0.0.1:${port}/api/v1/auth`;
  const projectsBase = `http://127.0.0.1:${port}/api/v1/projects`;

  // Seed one user per role directly (bypassing the register endpoint, which
  // always forces site_engineer) and log each in to obtain access tokens.
  console.log('Seeding users per role');
  const rolePasswords = 'supersecret123';
  const roleUsers: Record<UserRole, { id: string; token: string }> = {} as never;

  for (const role of ['super_admin', 'project_manager', 'site_engineer', 'accountant'] as UserRole[]) {
    const user = await UserModel.create({
      name: `${role} user`,
      email: `${role}@cpms.test`,
      password: rolePasswords,
      role,
    });
    const loginRes = await fetch(`${authBase}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, password: rolePasswords }),
    });
    const loginBody = await json(loginRes);
    roleUsers[role] = { id: user._id.toString(), token: loginBody.data?.accessToken };
  }
  check('All 4 role users logged in with access tokens', Object.values(roleUsers).every((u) => typeof u.token === 'string'));

  const authHeader = (role: UserRole) => ({ Authorization: `Bearer ${roleUsers[role].token}` });

  // 1. Create — RBAC
  console.log('\nCreate project (RBAC)');
  const validPayload = {
    name: 'Skyline Tower',
    client: 'Acme Developers',
    budget: 5_000_000,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    location: 'Chennai',
    manager: roleUsers.project_manager.id,
  };

  const noAuthRes = await fetch(projectsBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validPayload),
  });
  check('Create without auth returns 401', noAuthRes.status === 401);

  const engineerCreateRes = await fetch(projectsBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('site_engineer') },
    body: JSON.stringify(validPayload),
  });
  check('Create as site_engineer returns 403', engineerCreateRes.status === 403);

  const accountantCreateRes = await fetch(projectsBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('accountant') },
    body: JSON.stringify(validPayload),
  });
  check('Create as accountant returns 403', accountantCreateRes.status === 403);

  const pmCreateRes = await fetch(projectsBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify(validPayload),
  });
  const pmCreateBody = await json(pmCreateRes);
  check('Create as project_manager returns 201', pmCreateRes.status === 201);
  check('Created project has default status "planning"', pmCreateBody.data?.project?.status === 'planning');
  check('Created project manager is populated with a name', typeof pmCreateBody.data?.project?.manager?.name === 'string');
  const projectId = pmCreateBody.data?.project?._id as string;

  const adminCreateRes = await fetch(projectsBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ ...validPayload, name: 'Harbor View Complex', manager: undefined }),
  });
  check('Create as super_admin returns 201', adminCreateRes.status === 201);

  // 2. Validation
  console.log('\nValidation');
  const missingFieldRes = await fetch(projectsBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ name: 'Incomplete Project' }),
  });
  check('Create with missing required fields returns 400', missingFieldRes.status === 400);

  const badDatesRes = await fetch(projectsBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ ...validPayload, name: 'Bad Dates', startDate: '2026-06-01', endDate: '2026-01-01' }),
  });
  check('Create with endDate before startDate returns 400', badDatesRes.status === 400);

  const badManagerRes = await fetch(projectsBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ ...validPayload, name: 'Ghost Manager', manager: '507f1f77bcf86cd799439011' }),
  });
  check('Create with a non-existent manager id returns 400', badManagerRes.status === 400);

  // 3. List + pagination + filtering
  console.log('\nList projects');
  const listNoAuthRes = await fetch(projectsBase);
  check('List without auth returns 401', listNoAuthRes.status === 401);

  const listRes = await fetch(projectsBase, { headers: authHeader('site_engineer') });
  const listBody = await json(listRes);
  check('List as site_engineer (read-only role) returns 200', listRes.status === 200);
  check('List returns exactly the 2 created projects', listBody.data?.projects?.length === 2);
  check('List includes pagination meta', listBody.data?.meta?.total === 2);

  const pagedRes = await fetch(`${projectsBase}?limit=1&page=2`, { headers: authHeader('accountant') });
  const pagedBody = await json(pagedRes);
  check('Pagination limit=1&page=2 returns 1 project', pagedBody.data?.projects?.length === 1);
  check('Pagination meta reports totalPages=2', pagedBody.data?.meta?.totalPages === 2);

  const searchRes = await fetch(`${projectsBase}?search=Harbor`, { headers: authHeader('accountant') });
  const searchBody = await json(searchRes);
  check('Search by name filters to 1 matching project', searchBody.data?.projects?.length === 1);

  const badQueryRes = await fetch(`${projectsBase}?status=not_a_status`, { headers: authHeader('accountant') });
  check('Invalid status filter returns 400', badQueryRes.status === 400);

  // 4. Get by id
  console.log('\nGet project by id');
  const getRes = await fetch(`${projectsBase}/${projectId}`, { headers: authHeader('accountant') });
  const getBody = await json(getRes);
  check('Get existing project returns 200', getRes.status === 200);
  check('Get returns the correct project', getBody.data?.project?.name === 'Skyline Tower');

  const getMissingRes = await fetch(`${projectsBase}/507f1f77bcf86cd799439011`, {
    headers: authHeader('accountant'),
  });
  check('Get with a well-formed but unknown id returns 404', getMissingRes.status === 404);

  const getMalformedRes = await fetch(`${projectsBase}/not-an-object-id`, {
    headers: authHeader('accountant'),
  });
  check('Get with a malformed id returns 400 (CastError)', getMalformedRes.status === 400);

  // 5. Update — RBAC + validation
  console.log('\nUpdate project');
  const engineerUpdateRes = await fetch(`${projectsBase}/${projectId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader('site_engineer') },
    body: JSON.stringify({ status: 'in_progress' }),
  });
  check('Update as site_engineer returns 403', engineerUpdateRes.status === 403);

  const updateRes = await fetch(`${projectsBase}/${projectId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify({ status: 'in_progress', progress: 40 }),
  });
  const updateBody = await json(updateRes);
  check('Update as project_manager returns 200', updateRes.status === 200);
  check('Update applies new status', updateBody.data?.project?.status === 'in_progress');
  check('Update applies new progress', updateBody.data?.project?.progress === 40);

  const updateBadDatesRes = await fetch(`${projectsBase}/${projectId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify({ startDate: '2026-06-01', endDate: '2026-01-01' }),
  });
  check('Update with endDate before startDate returns 400', updateBadDatesRes.status === 400);

  // 6. Delete — RBAC
  console.log('\nDelete project');
  const pmDeleteRes = await fetch(`${projectsBase}/${projectId}`, {
    method: 'DELETE',
    headers: authHeader('project_manager'),
  });
  check('Delete as project_manager returns 403 (super_admin only)', pmDeleteRes.status === 403);

  const adminDeleteRes = await fetch(`${projectsBase}/${projectId}`, {
    method: 'DELETE',
    headers: authHeader('super_admin'),
  });
  check('Delete as super_admin returns 200', adminDeleteRes.status === 200);

  const getAfterDeleteRes = await fetch(`${projectsBase}/${projectId}`, {
    headers: authHeader('super_admin'),
  });
  check('Get after delete returns 404', getAfterDeleteRes.status === 404);

  const deleteAgainRes = await fetch(`${projectsBase}/${projectId}`, {
    method: 'DELETE',
    headers: authHeader('super_admin'),
  });
  check('Deleting an already-deleted project returns 404', deleteAgainRes.status === 404);

  // Cleanup
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  console.log(`\n${'='.repeat(40)}`);
  console.log(`Phase 5 project test: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(40));

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('\nTest run crashed:', err);
  process.exit(1);
});
