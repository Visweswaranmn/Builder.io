/**
 * Phase 11 smoke test — drives the real Express app's /expenses CRUD +
 * reporting endpoints over HTTP. Covers RBAC, project/vendor/material
 * reference validation, filtering, and the two finance reports (category
 * breakdown + budget-vs-actual). Run with:
 *   npm run test:expenses --workspace server
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import type { AddressInfo } from 'node:net';
import { createApp } from '../app.js';
import { UserModel } from '../models/user.model.js';
import { ProjectModel } from '../models/project.model.js';
import { VendorModel } from '../models/vendor.model.js';
import { MaterialModel } from '../models/material.model.js';
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
  const expensesBase = `http://127.0.0.1:${port}/api/v1/expenses`;

  console.log('Seeding users, two projects, a vendor, and a material');
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

  const projectA = await ProjectModel.create({
    name: 'Skyline Tower', client: 'Acme', budget: 100_000, startDate: new Date(),
  });
  const projectB = await ProjectModel.create({
    name: 'Harbor View', client: 'Acme', budget: 50_000, startDate: new Date(),
  });
  const vendor = await VendorModel.create({ name: 'BuildMart Supplies' });
  const material = await MaterialModel.create({ name: 'OPC Cement', unit: 'bag' });

  const authHeader = (role: UserRole) => ({ Authorization: `Bearer ${roleUsers[role].token}` });

  // 1. Create — RBAC + validation
  console.log('\nCreate expense (RBAC)');
  const validPayload = {
    project: projectA._id.toString(),
    category: 'material',
    amount: 20000,
    description: 'Cement bulk purchase',
    vendor: vendor._id.toString(),
    material: material._id.toString(),
    paymentMethod: 'bank_transfer',
  };

  const noAuthRes = await fetch(expensesBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validPayload),
  });
  check('Create without auth returns 401', noAuthRes.status === 401);

  const engineerCreateRes = await fetch(expensesBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('site_engineer') },
    body: JSON.stringify(validPayload),
  });
  check('Create as site_engineer returns 403', engineerCreateRes.status === 403);

  const accountantCreateRes = await fetch(expensesBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('accountant') },
    body: JSON.stringify(validPayload),
  });
  const accountantCreateBody = await json(accountantCreateRes);
  check('Create as accountant returns 201 (finance role)', accountantCreateRes.status === 201);
  check('Created expense records the correct amount', accountantCreateBody.data?.expense?.amount === 20000);
  check('Created expense project is populated with a name', accountantCreateBody.data?.expense?.project?.name === 'Skyline Tower');
  check('Created expense vendor is populated with a name', accountantCreateBody.data?.expense?.vendor?.name === 'BuildMart Supplies');
  check('Created expense records recordedBy as the creator', accountantCreateBody.data?.expense?.recordedBy?.role === 'accountant');
  const expenseId = accountantCreateBody.data?.expense?._id as string;

  const pmCreateRes = await fetch(expensesBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify({ project: projectA._id.toString(), category: 'labour', amount: 50000, description: 'Site crew wages' }),
  });
  check('Create as project_manager returns 201', pmCreateRes.status === 201);

  await fetch(expensesBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ project: projectB._id.toString(), category: 'transport', amount: 8000, description: 'Equipment transport' }),
  });

  // 2. Validation
  console.log('\nValidation');
  const missingProjectRes = await fetch(expensesBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ category: 'material', amount: 100 }),
  });
  check('Create with missing required project returns 400', missingProjectRes.status === 400);

  const badProjectRes = await fetch(expensesBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ project: '507f1f77bcf86cd799439011', category: 'material', amount: 100 }),
  });
  check('Create with a non-existent project id returns 400', badProjectRes.status === 400);

  const badVendorRes = await fetch(expensesBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ project: projectA._id.toString(), category: 'material', amount: 100, vendor: '507f1f77bcf86cd799439011' }),
  });
  check('Create with a non-existent vendor id returns 400', badVendorRes.status === 400);

  const negativeAmountRes = await fetch(expensesBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ project: projectA._id.toString(), category: 'material', amount: -50 }),
  });
  check('Create with a non-positive amount returns 400', negativeAmountRes.status === 400);

  // 3. List + filtering
  console.log('\nList expenses');
  const listNoAuthRes = await fetch(expensesBase);
  check('List without auth returns 401', listNoAuthRes.status === 401);

  const listRes = await fetch(expensesBase, { headers: authHeader('site_engineer') });
  const listBody = await json(listRes);
  check('List as site_engineer (read-only role) returns 200', listRes.status === 200);
  check('List returns all 3 created expenses', listBody.data?.expenses?.length === 3);

  const projectFilterRes = await fetch(`${expensesBase}?project=${projectA._id.toString()}`, {
    headers: authHeader('site_engineer'),
  });
  const projectFilterBody = await json(projectFilterRes);
  check('Project filter narrows to 2 expenses (projectA)', projectFilterBody.data?.expenses?.length === 2);

  const categoryFilterRes = await fetch(`${expensesBase}?category=transport`, { headers: authHeader('site_engineer') });
  const categoryFilterBody = await json(categoryFilterRes);
  check('Category filter narrows to 1 expense', categoryFilterBody.data?.expenses?.length === 1);

  const searchRes = await fetch(`${expensesBase}?search=crew`, { headers: authHeader('site_engineer') });
  const searchBody = await json(searchRes);
  check('Search by description filters to 1 expense', searchBody.data?.expenses?.length === 1);

  const badCategoryRes = await fetch(`${expensesBase}?category=not_a_category`, { headers: authHeader('site_engineer') });
  check('Invalid category filter returns 400', badCategoryRes.status === 400);

  // 4. Get by id
  console.log('\nGet expense by id');
  const getRes = await fetch(`${expensesBase}/${expenseId}`, { headers: authHeader('site_engineer') });
  const getBody = await json(getRes);
  check('Get existing expense returns 200', getRes.status === 200);
  check('Get returns the correct expense', getBody.data?.expense?.description === 'Cement bulk purchase');

  const getMissingRes = await fetch(`${expensesBase}/507f1f77bcf86cd799439011`, { headers: authHeader('site_engineer') });
  check('Get with a well-formed but unknown id returns 404', getMissingRes.status === 404);

  const getMalformedRes = await fetch(`${expensesBase}/not-an-object-id`, { headers: authHeader('site_engineer') });
  check('Get with a malformed id returns 400 (CastError)', getMalformedRes.status === 400);

  // 5. Update — RBAC
  console.log('\nUpdate expense');
  const engineerUpdateRes = await fetch(`${expensesBase}/${expenseId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader('site_engineer') },
    body: JSON.stringify({ amount: 25000 }),
  });
  check('Update as site_engineer returns 403', engineerUpdateRes.status === 403);

  const updateRes = await fetch(`${expensesBase}/${expenseId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader('accountant') },
    body: JSON.stringify({ amount: 25000 }),
  });
  const updateBody = await json(updateRes);
  check('Update as accountant returns 200', updateRes.status === 200);
  check('Update applies the new amount', updateBody.data?.expense?.amount === 25000);

  // 6. Reports
  console.log('\nReports');
  const noAuthReportRes = await fetch(`${expensesBase}/reports/by-category`);
  check('Category report without auth returns 401', noAuthReportRes.status === 401);

  const categoryReportRes = await fetch(`${expensesBase}/reports/by-category`, { headers: authHeader('site_engineer') });
  const categoryReportBody = await json(categoryReportRes);
  check('Category report (read-only role) returns 200', categoryReportRes.status === 200);
  check('Category report total sums all expenses (25000+50000+8000=83000)', categoryReportBody.data?.total === 83_000);
  check('Category report breaks down by category (3 categories)', categoryReportBody.data?.byCategory?.length === 3);

  const projectScopedReportRes = await fetch(`${expensesBase}/reports/by-category?project=${projectA._id.toString()}`, {
    headers: authHeader('site_engineer'),
  });
  const projectScopedReportBody = await json(projectScopedReportRes);
  check('Project-scoped category report totals only that project (25000+50000=75000)', projectScopedReportBody.data?.total === 75_000);

  const budgetReportRes = await fetch(`${expensesBase}/reports/budget-vs-actual`, { headers: authHeader('accountant') });
  const budgetReportBody = await json(budgetReportRes);
  check('Budget-vs-actual report returns 200', budgetReportRes.status === 200);
  check('Budget-vs-actual includes both projects', budgetReportBody.data?.projects?.length === 2);

  const projectARow = budgetReportBody.data?.projects?.find((p: any) => p.projectName === 'Skyline Tower');
  check('Project A actual spend is 75000 (25000+50000)', projectARow?.actual === 75_000);
  check('Project A variance is budget - actual (100000-75000=25000)', projectARow?.variance === 25_000);
  check('Project A percentUsed is 75', projectARow?.percentUsed === 75);

  const projectBRow = budgetReportBody.data?.projects?.find((p: any) => p.projectName === 'Harbor View');
  check('Project B actual spend is 8000', projectBRow?.actual === 8_000);
  check('Project B variance is 50000-8000=42000', projectBRow?.variance === 42_000);

  const scopedBudgetReportRes = await fetch(`${expensesBase}/reports/budget-vs-actual?project=${projectB._id.toString()}`, {
    headers: authHeader('accountant'),
  });
  const scopedBudgetReportBody = await json(scopedBudgetReportRes);
  check('Project-scoped budget-vs-actual returns only 1 project', scopedBudgetReportBody.data?.projects?.length === 1);

  // 7. Delete — RBAC
  console.log('\nDelete expense');
  const accountantDeleteRes = await fetch(`${expensesBase}/${expenseId}`, {
    method: 'DELETE',
    headers: authHeader('accountant'),
  });
  check('Delete as accountant returns 403 (super_admin only)', accountantDeleteRes.status === 403);

  const adminDeleteRes = await fetch(`${expensesBase}/${expenseId}`, {
    method: 'DELETE',
    headers: authHeader('super_admin'),
  });
  check('Delete as super_admin returns 200', adminDeleteRes.status === 200);

  const getAfterDeleteRes = await fetch(`${expensesBase}/${expenseId}`, { headers: authHeader('super_admin') });
  check('Get after delete returns 404', getAfterDeleteRes.status === 404);

  // Cleanup
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  console.log(`\n${'='.repeat(40)}`);
  console.log(`Phase 11 expense test: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(40));

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('\nTest run crashed:', err);
  process.exit(1);
});
