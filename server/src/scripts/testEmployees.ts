/**
 * Phase 6 smoke test — drives the real Express app's /employees CRUD +
 * attendance endpoints over HTTP, covering RBAC, project/manager/user
 * reference validation, attendance upsert-by-day, and edge cases. Run with:
 *   npm run test:employees --workspace server
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import type { AddressInfo } from 'node:net';
import { createApp } from '../app.js';
import { UserModel } from '../models/user.model.js';
import { ProjectModel } from '../models/project.model.js';
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
  const employeesBase = `http://127.0.0.1:${port}/api/v1/employees`;

  console.log('Seeding users per role + a project');
  const rolePassword = 'supersecret123';
  const roleUsers: Record<UserRole, { id: string; token: string }> = {} as never;

  for (const role of ['super_admin', 'project_manager', 'site_engineer', 'accountant'] as UserRole[]) {
    const user = await UserModel.create({
      name: `${role} user`,
      email: `${role}@cpms.test`,
      password: rolePassword,
      role,
    });
    const loginRes = await fetch(`${authBase}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, password: rolePassword }),
    });
    const loginBody = await json(loginRes);
    roleUsers[role] = { id: user._id.toString(), token: loginBody.data?.accessToken };
  }
  check('All 4 role users logged in with access tokens', Object.values(roleUsers).every((u) => typeof u.token === 'string'));

  const unlinkedUser = await UserModel.create({
    name: 'Unlinked Login',
    email: 'unlinked@cpms.test',
    password: rolePassword,
    role: 'site_engineer',
  });

  const project = await ProjectModel.create({
    name: 'Skyline Tower',
    client: 'Acme Developers',
    budget: 1_000_000,
    startDate: new Date('2026-01-01'),
  });

  const authHeader = (role: UserRole) => ({ Authorization: `Bearer ${roleUsers[role].token}` });

  // 1. Create — RBAC + validation
  console.log('\nCreate employee (RBAC)');
  const validPayload = {
    name: 'Kumar Worker',
    department: 'civil',
    designation: 'Mason',
    salary: 35000,
    project: project._id.toString(),
    manager: roleUsers.project_manager.id,
  };

  const noAuthRes = await fetch(employeesBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validPayload),
  });
  check('Create without auth returns 401', noAuthRes.status === 401);

  const engineerCreateRes = await fetch(employeesBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('site_engineer') },
    body: JSON.stringify(validPayload),
  });
  check('Create as site_engineer returns 403', engineerCreateRes.status === 403);

  const accountantCreateRes = await fetch(employeesBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('accountant') },
    body: JSON.stringify(validPayload),
  });
  check('Create as accountant returns 403', accountantCreateRes.status === 403);

  const pmCreateRes = await fetch(employeesBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify({ ...validPayload, user: unlinkedUser._id.toString() }),
  });
  const pmCreateBody = await json(pmCreateRes);
  check('Create as project_manager returns 201', pmCreateRes.status === 201);
  check('Created employee defaults isActive=true', pmCreateBody.data?.employee?.isActive === true);
  check('Created employee project is populated with a name', pmCreateBody.data?.employee?.project?.name === 'Skyline Tower');
  check('Created employee manager is populated with a name', typeof pmCreateBody.data?.employee?.manager?.name === 'string');
  const employeeId = pmCreateBody.data?.employee?._id as string;

  const adminCreateRes = await fetch(employeesBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ name: 'Second Employee', department: 'electrical' }),
  });
  check('Create as super_admin (minimal fields) returns 201', adminCreateRes.status === 201);

  // 2. Validation
  console.log('\nValidation');
  const missingNameRes = await fetch(employeesBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ department: 'civil' }),
  });
  check('Create with missing required name returns 400', missingNameRes.status === 400);

  const badProjectRes = await fetch(employeesBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ name: 'Ghost Project Worker', project: '507f1f77bcf86cd799439011' }),
  });
  check('Create with a non-existent project id returns 400', badProjectRes.status === 400);

  const badManagerRes = await fetch(employeesBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ name: 'Ghost Manager Worker', manager: '507f1f77bcf86cd799439011' }),
  });
  check('Create with a non-existent manager id returns 400', badManagerRes.status === 400);

  const dupUserRes = await fetch(employeesBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ name: 'Duplicate Link Worker', user: unlinkedUser._id.toString() }),
  });
  check('Create linking a user already linked to another employee returns 409', dupUserRes.status === 409);

  // 3. List + pagination + filtering
  console.log('\nList employees');
  const listNoAuthRes = await fetch(employeesBase);
  check('List without auth returns 401', listNoAuthRes.status === 401);

  const listRes = await fetch(employeesBase, { headers: authHeader('site_engineer') });
  const listBody = await json(listRes);
  check('List as site_engineer (read-only role) returns 200', listRes.status === 200);
  check('List returns exactly the 2 created employees', listBody.data?.employees?.length === 2);

  const deptFilterRes = await fetch(`${employeesBase}?department=electrical`, {
    headers: authHeader('accountant'),
  });
  const deptFilterBody = await json(deptFilterRes);
  check('Department filter narrows to 1 employee', deptFilterBody.data?.employees?.length === 1);

  const projectFilterRes = await fetch(`${employeesBase}?project=${project._id.toString()}`, {
    headers: authHeader('accountant'),
  });
  const projectFilterBody = await json(projectFilterRes);
  check('Project filter narrows to 1 employee', projectFilterBody.data?.employees?.length === 1);

  const searchRes = await fetch(`${employeesBase}?search=Kumar`, { headers: authHeader('accountant') });
  const searchBody = await json(searchRes);
  check('Search by name filters to 1 matching employee', searchBody.data?.employees?.length === 1);

  const badQueryRes = await fetch(`${employeesBase}?department=not_a_department`, {
    headers: authHeader('accountant'),
  });
  check('Invalid department filter returns 400', badQueryRes.status === 400);

  // 4. Get by id
  console.log('\nGet employee by id');
  const getRes = await fetch(`${employeesBase}/${employeeId}`, { headers: authHeader('accountant') });
  const getBody = await json(getRes);
  check('Get existing employee returns 200', getRes.status === 200);
  check('Get returns the correct employee', getBody.data?.employee?.name === 'Kumar Worker');

  const getMissingRes = await fetch(`${employeesBase}/507f1f77bcf86cd799439011`, {
    headers: authHeader('accountant'),
  });
  check('Get with a well-formed but unknown id returns 404', getMissingRes.status === 404);

  const getMalformedRes = await fetch(`${employeesBase}/not-an-object-id`, {
    headers: authHeader('accountant'),
  });
  check('Get with a malformed id returns 400 (CastError)', getMalformedRes.status === 400);

  // 5. Update — RBAC
  console.log('\nUpdate employee');
  const engineerUpdateRes = await fetch(`${employeesBase}/${employeeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader('site_engineer') },
    body: JSON.stringify({ salary: 40000 }),
  });
  check('Update as site_engineer returns 403', engineerUpdateRes.status === 403);

  const updateRes = await fetch(`${employeesBase}/${employeeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify({ salary: 40000, designation: 'Senior Mason' }),
  });
  const updateBody = await json(updateRes);
  check('Update as project_manager returns 200', updateRes.status === 200);
  check('Update applies new salary', updateBody.data?.employee?.salary === 40000);
  check('Update applies new designation', updateBody.data?.employee?.designation === 'Senior Mason');

  // 6. Attendance
  console.log('\nAttendance');
  const noAuthAttendanceRes = await fetch(`${employeesBase}/${employeeId}/attendance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: '2026-02-01', status: 'present' }),
  });
  check('Mark attendance without auth returns 401', noAuthAttendanceRes.status === 401);

  const engineerAttendanceRes = await fetch(`${employeesBase}/${employeeId}/attendance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('site_engineer') },
    body: JSON.stringify({ date: '2026-02-01', status: 'present' }),
  });
  check('Mark attendance as site_engineer returns 403', engineerAttendanceRes.status === 403);

  const markRes = await fetch(`${employeesBase}/${employeeId}/attendance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify({ date: '2026-02-01', status: 'present' }),
  });
  const markBody = await json(markRes);
  check('Mark attendance returns 201', markRes.status === 201);
  check('Attendance array has 1 entry', markBody.data?.attendance?.length === 1);

  const markSecondDayRes = await fetch(`${employeesBase}/${employeeId}/attendance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify({ date: '2026-02-02', status: 'absent' }),
  });
  const markSecondDayBody = await json(markSecondDayRes);
  check('Marking a second day adds a new entry (2 total)', markSecondDayBody.data?.attendance?.length === 2);

  const markSameDayRes = await fetch(`${employeesBase}/${employeeId}/attendance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify({ date: '2026-02-01T18:00:00.000Z', status: 'half_day', note: 'left early' }),
  });
  const markSameDayBody = await json(markSameDayRes);
  check('Re-marking the same calendar day upserts (still 2 total)', markSameDayBody.data?.attendance?.length === 2);
  const feb1Entry = markSameDayBody.data?.attendance?.find((a: any) => a.note === 'left early');
  check('Upserted entry reflects the corrected status', feb1Entry?.status === 'half_day');

  const getAttendanceRes = await fetch(`${employeesBase}/${employeeId}/attendance`, {
    headers: authHeader('accountant'),
  });
  const getAttendanceBody = await json(getAttendanceRes);
  check('Get attendance (read-only role) returns 200', getAttendanceRes.status === 200);
  check('Get attendance returns both days', getAttendanceBody.data?.attendance?.length === 2);

  const rangeRes = await fetch(`${employeesBase}/${employeeId}/attendance?from=2026-02-02`, {
    headers: authHeader('accountant'),
  });
  const rangeBody = await json(rangeRes);
  check('Attendance date-range filter (from=2026-02-02) returns 1 entry', rangeBody.data?.attendance?.length === 1);

  const badAttendanceRes = await fetch(`${employeesBase}/${employeeId}/attendance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify({ date: '2026-02-03', status: 'not_a_status' }),
  });
  check('Marking attendance with an invalid status returns 400', badAttendanceRes.status === 400);

  // 7. Delete — RBAC
  console.log('\nDelete employee');
  const pmDeleteRes = await fetch(`${employeesBase}/${employeeId}`, {
    method: 'DELETE',
    headers: authHeader('project_manager'),
  });
  check('Delete as project_manager returns 403 (super_admin only)', pmDeleteRes.status === 403);

  const adminDeleteRes = await fetch(`${employeesBase}/${employeeId}`, {
    method: 'DELETE',
    headers: authHeader('super_admin'),
  });
  check('Delete as super_admin returns 200', adminDeleteRes.status === 200);

  const getAfterDeleteRes = await fetch(`${employeesBase}/${employeeId}`, {
    headers: authHeader('super_admin'),
  });
  check('Get after delete returns 404', getAfterDeleteRes.status === 404);

  // Cleanup
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  console.log(`\n${'='.repeat(40)}`);
  console.log(`Phase 6 employee test: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(40));

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('\nTest run crashed:', err);
  process.exit(1);
});
