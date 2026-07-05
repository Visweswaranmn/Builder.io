/**
 * Phase 13 smoke test — covers the notification CRUD-lite API (list/unread
 * count/mark-read/mark-all/delete, always scoped to the caller) AND the
 * cross-service trigger wiring: material low-stock, task assignment, expense
 * over-budget, and the deadline-reminder scan. Run with:
 *   npm run test:notifications --workspace server
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
  const notificationsBase = `http://127.0.0.1:${port}/api/v1/notifications`;
  const materialsBase = `http://127.0.0.1:${port}/api/v1/materials`;
  const tasksBase = `http://127.0.0.1:${port}/api/v1/tasks`;
  const expensesBase = `http://127.0.0.1:${port}/api/v1/expenses`;

  console.log('Seeding users, a project, and employees');
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
    name: 'Skyline Tower', client: 'Acme', budget: 1000, startDate: new Date(), manager: roleUsers.project_manager.id,
  });
  const engineerEmployee = await EmployeeModel.create({
    name: 'Kumar Worker', department: 'civil', project: project._id, user: roleUsers.site_engineer.id,
  });
  const accountantEmployee = await EmployeeModel.create({
    name: 'Accountant Worker', department: 'other', project: project._id, user: roleUsers.accountant.id,
  });
  const unlinkedEmployee = await EmployeeModel.create({ name: 'No Login Worker', department: 'other' });

  const authHeader = (role: UserRole) => ({ Authorization: `Bearer ${roleUsers[role].token}` });

  // 1. Material low-stock trigger
  console.log('\nMaterial low-stock trigger');
  const materialRes = await fetch(materialsBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ name: 'Cement', unit: 'bag', quantityInStock: 20, lowStockThreshold: 10, project: project._id.toString() }),
  });
  const materialBody = await json(materialRes);
  const materialId = materialBody.data?.material?._id as string;

  const notLowStockOutRes = await fetch(`${materialsBase}/${materialId}/stock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ type: 'out', quantity: 5 }), // 20 -> 15, still above threshold
  });
  check('Stock-out that stays above threshold succeeds', notLowStockOutRes.status === 201);

  const adminNotifsBeforeRes = await fetch(notificationsBase, { headers: authHeader('super_admin') });
  const adminNotifsBeforeBody = await json(adminNotifsBeforeRes);
  check('No material_low notification yet (still above threshold)', adminNotifsBeforeBody.data?.notifications?.length === 0);

  const lowStockOutRes = await fetch(`${materialsBase}/${materialId}/stock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ type: 'out', quantity: 10 }), // 15 -> 5, now at/below threshold
  });
  check('Stock-out that crosses the threshold succeeds', lowStockOutRes.status === 201);

  const adminNotifsRes = await fetch(notificationsBase, { headers: authHeader('super_admin') });
  const adminNotifsBody = await json(adminNotifsRes);
  check('super_admin receives a material_low notification', adminNotifsBody.data?.notifications?.some((n: any) => n.type === 'material_low'));

  const pmNotifsRes = await fetch(notificationsBase, { headers: authHeader('project_manager') });
  const pmNotifsBody = await json(pmNotifsRes);
  check(
    "The project's manager also receives the material_low notification",
    pmNotifsBody.data?.notifications?.some((n: any) => n.type === 'material_low'),
  );

  // 2. Task-assignment trigger
  console.log('\nTask assignment trigger');
  const taskCreateRes = await fetch(tasksBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify({ title: 'Pour foundation', project: project._id.toString(), assignedTo: engineerEmployee._id.toString() }),
  });
  const taskCreateBody = await json(taskCreateRes);
  const taskId = taskCreateBody.data?.task?._id as string;

  const engineerNotifsRes = await fetch(notificationsBase, { headers: authHeader('site_engineer') });
  const engineerNotifsBody = await json(engineerNotifsRes);
  check(
    'The assigned employee\'s linked user receives a task_assigned notification',
    engineerNotifsBody.data?.notifications?.some((n: any) => n.type === 'task_assigned'),
  );

  const reassignToUnlinkedRes = await fetch(`${tasksBase}/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify({ assignedTo: unlinkedEmployee._id.toString() }),
  });
  check('Reassigning to an employee with no linked login succeeds without error', reassignToUnlinkedRes.status === 200);

  const reassignToAccountantRes = await fetch(`${tasksBase}/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify({ assignedTo: accountantEmployee._id.toString() }),
  });
  check('Reassigning to a different linked employee succeeds', reassignToAccountantRes.status === 200);

  const accountantNotifsRes = await fetch(notificationsBase, { headers: authHeader('accountant') });
  const accountantNotifsBody = await json(accountantNotifsRes);
  check(
    'The newly-assigned employee\'s user receives a task_assigned notification on reassignment',
    accountantNotifsBody.data?.notifications?.some((n: any) => n.type === 'task_assigned'),
  );

  // 3. Expense over-budget trigger (project budget = 1000)
  console.log('\nExpense over-budget trigger');
  await fetch(expensesBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('accountant') },
    body: JSON.stringify({ project: project._id.toString(), category: 'material', amount: 600 }),
  });
  const adminNotifsAfterFirstExpenseRes = await fetch(notificationsBase, { headers: authHeader('super_admin') });
  const adminNotifsAfterFirstExpenseBody = await json(adminNotifsAfterFirstExpenseRes);
  check(
    'No expense_limit notification yet (600 of 1000 budget)',
    !adminNotifsAfterFirstExpenseBody.data?.notifications?.some((n: any) => n.type === 'expense_limit'),
  );

  await fetch(expensesBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('accountant') },
    body: JSON.stringify({ project: project._id.toString(), category: 'labour', amount: 500 }), // total 1100 > 1000
  });
  const adminNotifsAfterSecondExpenseRes = await fetch(notificationsBase, { headers: authHeader('super_admin') });
  const adminNotifsAfterSecondExpenseBody = await json(adminNotifsAfterSecondExpenseRes);
  const expenseLimitCountAfterSecond = adminNotifsAfterSecondExpenseBody.data?.notifications?.filter((n: any) => n.type === 'expense_limit').length;
  check('Crossing the budget triggers exactly 1 expense_limit notification', expenseLimitCountAfterSecond === 1);

  await fetch(expensesBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('accountant') },
    body: JSON.stringify({ project: project._id.toString(), category: 'transport', amount: 100 }), // total 1200, still over
  });
  const adminNotifsAfterThirdExpenseRes = await fetch(notificationsBase, { headers: authHeader('super_admin') });
  const adminNotifsAfterThirdExpenseBody = await json(adminNotifsAfterThirdExpenseRes);
  const expenseLimitCountAfterThird = adminNotifsAfterThirdExpenseBody.data?.notifications?.filter((n: any) => n.type === 'expense_limit').length;
  check('A further expense while already over budget does NOT re-notify (still 1)', expenseLimitCountAfterThird === 1);

  // 4. Notification CRUD — always scoped to the caller
  console.log('\nNotification CRUD (ownership-scoped)');
  const noAuthListRes = await fetch(notificationsBase);
  check('List without auth returns 401', noAuthListRes.status === 401);

  const unreadCountRes = await fetch(`${notificationsBase}/unread-count`, { headers: authHeader('super_admin') });
  const unreadCountBody = await json(unreadCountRes);
  check('Unread count reflects the material_low + expense_limit notifications (2)', unreadCountBody.data?.count === 2);

  const someNotificationId = adminNotifsAfterThirdExpenseBody.data?.notifications?.[0]?._id as string;

  const markOwnReadRes = await fetch(`${notificationsBase}/${someNotificationId}/read`, {
    method: 'PATCH',
    headers: authHeader('super_admin'),
  });
  const markOwnReadBody = await json(markOwnReadRes);
  check('Marking own notification as read returns 200', markOwnReadRes.status === 200);
  check('Notification is now marked read', markOwnReadBody.data?.notification?.isRead === true);

  const markOthersReadRes = await fetch(`${notificationsBase}/${someNotificationId}/read`, {
    method: 'PATCH',
    headers: authHeader('accountant'), // does not own super_admin's notification
  });
  check("Marking someone ELSE's notification as read returns 404 (ownership hidden, not 403)", markOthersReadRes.status === 404);

  const deleteOthersRes = await fetch(`${notificationsBase}/${someNotificationId}`, {
    method: 'DELETE',
    headers: authHeader('accountant'),
  });
  check("Deleting someone ELSE's notification returns 404", deleteOthersRes.status === 404);

  const isReadFilterRes = await fetch(`${notificationsBase}?isRead=true`, { headers: authHeader('super_admin') });
  const isReadFilterBody = await json(isReadFilterRes);
  check('isRead=true filter returns exactly the 1 read notification', isReadFilterBody.data?.notifications?.length === 1);

  const typeFilterRes = await fetch(`${notificationsBase}?type=expense_limit`, { headers: authHeader('super_admin') });
  const typeFilterBody = await json(typeFilterRes);
  check('type=expense_limit filter returns exactly 1 notification', typeFilterBody.data?.notifications?.length === 1);

  const markAllReadRes = await fetch(`${notificationsBase}/read-all`, {
    method: 'PATCH',
    headers: authHeader('super_admin'),
  });
  const markAllReadBody = await json(markAllReadRes);
  check('Mark-all-as-read returns 200', markAllReadRes.status === 200);
  check('Mark-all-as-read reports 1 newly-modified notification (the other was already read)', markAllReadBody.data?.modifiedCount === 1);

  const unreadAfterMarkAllRes = await fetch(`${notificationsBase}/unread-count`, { headers: authHeader('super_admin') });
  const unreadAfterMarkAllBody = await json(unreadAfterMarkAllRes);
  check('Unread count is now 0', unreadAfterMarkAllBody.data?.count === 0);

  const deleteOwnRes = await fetch(`${notificationsBase}/${someNotificationId}`, {
    method: 'DELETE',
    headers: authHeader('super_admin'),
  });
  check('Deleting own notification returns 200', deleteOwnRes.status === 200);

  // 5. Deadline reminders
  console.log('\nDeadline reminders');
  const soon = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12h from now, within the 48h window
  await fetch(`${tasksBase}/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify({ deadline: soon.toISOString(), assignedTo: engineerEmployee._id.toString() }),
  });

  const nonAdminReminderRes = await fetch(`${notificationsBase}/run-deadline-check`, {
    method: 'POST',
    headers: authHeader('project_manager'),
  });
  check('Running the deadline check as a non-admin returns 403', nonAdminReminderRes.status === 403);

  const reminderRes = await fetch(`${notificationsBase}/run-deadline-check`, {
    method: 'POST',
    headers: authHeader('super_admin'),
  });
  const reminderBody = await json(reminderRes);
  check('Deadline check as super_admin returns 200', reminderRes.status === 200);
  check('Deadline check creates at least 1 reminder', (reminderBody.data?.created ?? 0) >= 1);

  const engineerRemindersRes = await fetch(`${notificationsBase}?type=deadline_reminder`, { headers: authHeader('site_engineer') });
  const engineerRemindersBody = await json(engineerRemindersRes);
  check('The assigned employee receives the deadline_reminder', engineerRemindersBody.data?.notifications?.length === 1);

  const secondReminderRes = await fetch(`${notificationsBase}/run-deadline-check`, {
    method: 'POST',
    headers: authHeader('super_admin'),
  });
  const secondReminderBody = await json(secondReminderRes);
  check('Re-running the scan immediately does not duplicate the reminder (created=0)', secondReminderBody.data?.created === 0);

  // Cleanup
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  console.log(`\n${'='.repeat(40)}`);
  console.log(`Phase 13 notification test: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(40));

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('\nTest run crashed:', err);
  process.exit(1);
});
