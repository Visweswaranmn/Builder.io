/**
 * Phase 7 smoke test — drives the real Express app's /tasks CRUD +
 * ownership-based progress endpoint over HTTP. Covers RBAC, project/employee
 * reference validation, filtering, the completed-status progress hook, and
 * the "assigned employee can update their own task" ownership rule. Run with:
 *   npm run test:tasks --workspace server
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import type { AddressInfo } from 'node:net';
import { createApp } from '../app.js';
import { UserModel } from '../models/user.model.js';
import { ProjectModel } from '../models/project.model.js';
import { EmployeeModel } from '../models/employee.model.js';
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
  const tasksBase = `http://127.0.0.1:${port}/api/v1/tasks`;

  console.log('Seeding users, a project, and two employees');
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

  const project = await ProjectModel.create({
    name: 'Skyline Tower',
    client: 'Acme Developers',
    budget: 1_000_000,
    startDate: new Date('2026-01-01'),
  });

  // The site_engineer test user IS this employee (linked via `user`) — used to
  // verify ownership-based progress updates. The accountant is a bystander
  // with no linked employee record, used to verify they're rejected.
  const ownerEmployee = await EmployeeModel.create({
    name: 'Kumar Worker',
    department: 'civil',
    project: project._id,
    user: roleUsers.site_engineer.id,
  });
  const otherEmployee = await EmployeeModel.create({
    name: 'Second Worker',
    department: 'electrical',
    project: project._id,
  });

  const authHeader = (role: UserRole) => ({ Authorization: `Bearer ${roleUsers[role].token}` });

  // 1. Create — RBAC + validation
  console.log('\nCreate task (RBAC)');
  const validPayload = {
    title: 'Pour foundation - Block A',
    project: project._id.toString(),
    assignedTo: ownerEmployee._id.toString(),
    priority: 'high',
    deadline: '2026-03-01',
  };

  const noAuthRes = await fetch(tasksBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validPayload),
  });
  check('Create without auth returns 401', noAuthRes.status === 401);

  const engineerCreateRes = await fetch(tasksBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('site_engineer') },
    body: JSON.stringify(validPayload),
  });
  check('Create as site_engineer returns 403', engineerCreateRes.status === 403);

  const accountantCreateRes = await fetch(tasksBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('accountant') },
    body: JSON.stringify(validPayload),
  });
  check('Create as accountant returns 403', accountantCreateRes.status === 403);

  const pmCreateRes = await fetch(tasksBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify(validPayload),
  });
  const pmCreateBody = await json(pmCreateRes);
  check('Create as project_manager returns 201', pmCreateRes.status === 201);
  check('Created task defaults to status "todo"', pmCreateBody.data?.task?.status === 'todo');
  check('Created task records assignedBy as the creator', pmCreateBody.data?.task?.assignedBy?._id === roleUsers.project_manager.id || pmCreateBody.data?.task?.assignedBy?.name === 'project_manager user');
  check('Created task project is populated with a name', pmCreateBody.data?.task?.project?.name === 'Skyline Tower');
  check('Created task assignedTo is populated with a name', pmCreateBody.data?.task?.assignedTo?.name === 'Kumar Worker');
  const taskId = pmCreateBody.data?.task?._id as string;

  const secondTaskRes = await fetch(tasksBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({
      title: 'Electrical wiring - Block B',
      project: project._id.toString(),
      assignedTo: otherEmployee._id.toString(),
      priority: 'medium',
    }),
  });
  const secondTaskBody = await json(secondTaskRes);
  check('Create as super_admin returns 201', secondTaskRes.status === 201);
  const otherTaskId = secondTaskBody.data?.task?._id as string;

  // 2. Validation
  console.log('\nValidation');
  const missingTitleRes = await fetch(tasksBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ project: project._id.toString() }),
  });
  check('Create with missing required title returns 400', missingTitleRes.status === 400);

  const missingProjectRes = await fetch(tasksBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ title: 'No project task' }),
  });
  check('Create with missing required project returns 400', missingProjectRes.status === 400);

  const badProjectRes = await fetch(tasksBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ title: 'Ghost project task', project: '507f1f77bcf86cd799439011' }),
  });
  check('Create with a non-existent project id returns 400', badProjectRes.status === 400);

  const badAssigneeRes = await fetch(tasksBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({
      title: 'Ghost assignee task',
      project: project._id.toString(),
      assignedTo: '507f1f77bcf86cd799439011',
    }),
  });
  check('Create with a non-existent assignedTo id returns 400', badAssigneeRes.status === 400);

  // 3. List + filtering
  console.log('\nList tasks');
  const listNoAuthRes = await fetch(tasksBase);
  check('List without auth returns 401', listNoAuthRes.status === 401);

  const listRes = await fetch(tasksBase, { headers: authHeader('accountant') });
  const listBody = await json(listRes);
  check('List as accountant (read-only role) returns 200', listRes.status === 200);
  check('List returns exactly the 2 created tasks', listBody.data?.tasks?.length === 2);

  const priorityFilterRes = await fetch(`${tasksBase}?priority=high`, { headers: authHeader('accountant') });
  const priorityFilterBody = await json(priorityFilterRes);
  check('Priority filter narrows to 1 task', priorityFilterBody.data?.tasks?.length === 1);

  const assignedToFilterRes = await fetch(`${tasksBase}?assignedTo=${otherEmployee._id.toString()}`, {
    headers: authHeader('accountant'),
  });
  const assignedToFilterBody = await json(assignedToFilterRes);
  check('assignedTo filter narrows to 1 task', assignedToFilterBody.data?.tasks?.length === 1);

  const mineRes = await fetch(`${tasksBase}?assignedToMe=true`, { headers: authHeader('site_engineer') });
  const mineBody = await json(mineRes);
  check('assignedToMe returns only the requesting employee\'s task', mineBody.data?.tasks?.length === 1);
  check('assignedToMe task is the one assigned to the owning employee', mineBody.data?.tasks?.[0]?._id === taskId);

  const mineNoEmployeeRes = await fetch(`${tasksBase}?assignedToMe=true`, { headers: authHeader('accountant') });
  const mineNoEmployeeBody = await json(mineNoEmployeeRes);
  check('assignedToMe for a user with no linked employee returns 0 tasks', mineNoEmployeeBody.data?.tasks?.length === 0);

  const searchRes = await fetch(`${tasksBase}?search=foundation`, { headers: authHeader('accountant') });
  const searchBody = await json(searchRes);
  check('Search by title filters to 1 matching task', searchBody.data?.tasks?.length === 1);

  const badStatusFilterRes = await fetch(`${tasksBase}?status=not_a_status`, { headers: authHeader('accountant') });
  check('Invalid status filter returns 400', badStatusFilterRes.status === 400);

  // 4. Get by id
  console.log('\nGet task by id');
  const getRes = await fetch(`${tasksBase}/${taskId}`, { headers: authHeader('accountant') });
  const getBody = await json(getRes);
  check('Get existing task returns 200', getRes.status === 200);
  check('Get returns the correct task', getBody.data?.task?.title === 'Pour foundation - Block A');

  const getMissingRes = await fetch(`${tasksBase}/507f1f77bcf86cd799439011`, { headers: authHeader('accountant') });
  check('Get with a well-formed but unknown id returns 404', getMissingRes.status === 404);

  const getMalformedRes = await fetch(`${tasksBase}/not-an-object-id`, { headers: authHeader('accountant') });
  check('Get with a malformed id returns 400 (CastError)', getMalformedRes.status === 400);

  // 5. Full update — manager only
  console.log('\nUpdate task (manager-only full edit)');
  const engineerUpdateRes = await fetch(`${tasksBase}/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader('site_engineer') },
    body: JSON.stringify({ title: 'Renamed by non-manager' }),
  });
  check('Full update as site_engineer returns 403', engineerUpdateRes.status === 403);

  const updateRes = await fetch(`${tasksBase}/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify({ priority: 'urgent', deadline: '2026-04-01' }),
  });
  const updateBody = await json(updateRes);
  check('Full update as project_manager returns 200', updateRes.status === 200);
  check('Full update applies new priority', updateBody.data?.task?.priority === 'urgent');

  // 6. Ownership-based progress updates
  console.log('\nProgress updates (ownership rule)');
  const noAuthProgressRes = await fetch(`${tasksBase}/${taskId}/progress`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ progress: 50 }),
  });
  check('Progress update without auth returns 401', noAuthProgressRes.status === 401);

  const emptyProgressRes = await fetch(`${tasksBase}/${taskId}/progress`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader('site_engineer') },
    body: JSON.stringify({}),
  });
  check('Progress update with neither field returns 400', emptyProgressRes.status === 400);

  const ownerProgressRes = await fetch(`${tasksBase}/${taskId}/progress`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader('site_engineer') },
    body: JSON.stringify({ progress: 60 }),
  });
  const ownerProgressBody = await json(ownerProgressRes);
  check('Progress update by the OWNING employee returns 200', ownerProgressRes.status === 200);
  check('Progress update applies the new value', ownerProgressBody.data?.task?.progress === 60);

  const nonOwnerProgressRes = await fetch(`${tasksBase}/${otherTaskId}/progress`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader('site_engineer') },
    body: JSON.stringify({ progress: 20 }),
  });
  check(
    'Progress update by a NON-owning employee on someone else\'s task returns 403',
    nonOwnerProgressRes.status === 403,
  );

  const accountantProgressRes = await fetch(`${tasksBase}/${taskId}/progress`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader('accountant') },
    body: JSON.stringify({ progress: 10 }),
  });
  check(
    'Progress update by a user with no linked employee returns 403',
    accountantProgressRes.status === 403,
  );

  const managerProgressRes = await fetch(`${tasksBase}/${otherTaskId}/progress`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify({ status: 'completed' }),
  });
  const managerProgressBody = await json(managerProgressRes);
  check('Manager can update progress on ANY task (not just their own)', managerProgressRes.status === 200);
  check(
    'Marking a task completed via the progress endpoint forces progress=100 (schema hook)',
    managerProgressBody.data?.task?.progress === 100,
  );
  check('Completed task gets a completedAt timestamp', Boolean(managerProgressBody.data?.task?.completedAt));

  // 7. Delete
  console.log('\nDelete task');
  const engineerDeleteRes = await fetch(`${tasksBase}/${taskId}`, {
    method: 'DELETE',
    headers: authHeader('site_engineer'),
  });
  check('Delete as site_engineer returns 403', engineerDeleteRes.status === 403);

  const deleteRes = await fetch(`${tasksBase}/${taskId}`, {
    method: 'DELETE',
    headers: authHeader('project_manager'),
  });
  check('Delete as project_manager returns 200', deleteRes.status === 200);

  const getAfterDeleteRes = await fetch(`${tasksBase}/${taskId}`, { headers: authHeader('super_admin') });
  check('Get after delete returns 404', getAfterDeleteRes.status === 404);

  // Cleanup
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  console.log(`\n${'='.repeat(40)}`);
  console.log(`Phase 7 task test: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(40));

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('\nTest run crashed:', err);
  process.exit(1);
});
