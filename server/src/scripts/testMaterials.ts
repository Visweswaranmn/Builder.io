/**
 * Phase 8 smoke test — drives the real Express app's /materials CRUD + stock
 * in/out ledger over HTTP. Covers RBAC, vendor/project reference validation,
 * insufficient-stock rejection, low-stock filtering, and transaction history.
 * Run with:
 *   npm run test:materials --workspace server
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import type { AddressInfo } from 'node:net';
import { createApp } from '../app.js';
import { UserModel } from '../models/user.model.js';
import { ProjectModel } from '../models/project.model.js';
import { VendorModel } from '../models/vendor.model.js';
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
  const materialsBase = `http://127.0.0.1:${port}/api/v1/materials`;

  console.log('Seeding users, a project, and a vendor');
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
  const vendor = await VendorModel.create({ name: 'BuildMart Supplies', phone: '9990001234' });

  const authHeader = (role: UserRole) => ({ Authorization: `Bearer ${roleUsers[role].token}` });

  // 1. Create — RBAC + validation
  console.log('\nCreate material (RBAC)');
  const validPayload = {
    name: 'OPC Cement 53 Grade',
    category: 'cement',
    unit: 'bag',
    quantityInStock: 20,
    lowStockThreshold: 10,
    unitPrice: 380,
    vendor: vendor._id.toString(),
    project: project._id.toString(),
  };

  const noAuthRes = await fetch(materialsBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validPayload),
  });
  check('Create without auth returns 401', noAuthRes.status === 401);

  const engineerCreateRes = await fetch(materialsBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('site_engineer') },
    body: JSON.stringify(validPayload),
  });
  check('Create as site_engineer returns 403 (can move stock, not define materials)', engineerCreateRes.status === 403);

  const accountantCreateRes = await fetch(materialsBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('accountant') },
    body: JSON.stringify(validPayload),
  });
  check('Create as accountant returns 403', accountantCreateRes.status === 403);

  const pmCreateRes = await fetch(materialsBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify(validPayload),
  });
  const pmCreateBody = await json(pmCreateRes);
  check('Create as project_manager returns 201', pmCreateRes.status === 201);
  check('Created material starts with the given stock quantity', pmCreateBody.data?.material?.quantityInStock === 20);
  check('Created material is NOT low stock (20 > threshold 10)', pmCreateBody.data?.material?.isLowStock === false);
  check('Created material vendor is populated with a name', pmCreateBody.data?.material?.vendor?.name === 'BuildMart Supplies');
  const materialId = pmCreateBody.data?.material?._id as string;

  const lowStockCreateRes = await fetch(materialsBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ name: 'TMT Steel Bar', category: 'steel', unit: 'ton', quantityInStock: 3, lowStockThreshold: 5 }),
  });
  const lowStockBody = await json(lowStockCreateRes);
  check('Create as super_admin returns 201', lowStockCreateRes.status === 201);
  check('A material below its threshold reports isLowStock=true', lowStockBody.data?.material?.isLowStock === true);
  const lowStockMaterialId = lowStockBody.data?.material?._id as string;

  // 2. Validation
  console.log('\nValidation');
  const missingNameRes = await fetch(materialsBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ category: 'sand' }),
  });
  check('Create with missing required name returns 400', missingNameRes.status === 400);

  const badVendorRes = await fetch(materialsBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ name: 'Ghost Vendor Material', vendor: '507f1f77bcf86cd799439011' }),
  });
  check('Create with a non-existent vendor id returns 400', badVendorRes.status === 400);

  const badProjectRes = await fetch(materialsBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ name: 'Ghost Project Material', project: '507f1f77bcf86cd799439011' }),
  });
  check('Create with a non-existent project id returns 400', badProjectRes.status === 400);

  // 3. List + filtering
  console.log('\nList materials');
  const listNoAuthRes = await fetch(materialsBase);
  check('List without auth returns 401', listNoAuthRes.status === 401);

  const listRes = await fetch(materialsBase, { headers: authHeader('accountant') });
  const listBody = await json(listRes);
  check('List as accountant (read-only role) returns 200', listRes.status === 200);
  check('List returns exactly the 2 created materials', listBody.data?.materials?.length === 2);

  const categoryFilterRes = await fetch(`${materialsBase}?category=steel`, { headers: authHeader('accountant') });
  const categoryFilterBody = await json(categoryFilterRes);
  check('Category filter narrows to 1 material', categoryFilterBody.data?.materials?.length === 1);

  const lowStockOnlyRes = await fetch(`${materialsBase}?lowStockOnly=true`, { headers: authHeader('accountant') });
  const lowStockOnlyBody = await json(lowStockOnlyRes);
  check('lowStockOnly filter returns exactly the 1 low-stock material', lowStockOnlyBody.data?.materials?.length === 1);
  check('lowStockOnly result is the TMT Steel Bar', lowStockOnlyBody.data?.materials?.[0]?.name === 'TMT Steel Bar');

  const searchRes = await fetch(`${materialsBase}?search=Cement`, { headers: authHeader('accountant') });
  const searchBody = await json(searchRes);
  check('Search by name filters to 1 matching material', searchBody.data?.materials?.length === 1);

  const badCategoryRes = await fetch(`${materialsBase}?category=not_a_category`, { headers: authHeader('accountant') });
  check('Invalid category filter returns 400', badCategoryRes.status === 400);

  // 4. Get by id
  console.log('\nGet material by id');
  const getRes = await fetch(`${materialsBase}/${materialId}`, { headers: authHeader('accountant') });
  const getBody = await json(getRes);
  check('Get existing material returns 200', getRes.status === 200);
  check('Get returns the correct material', getBody.data?.material?.name === 'OPC Cement 53 Grade');

  const getMissingRes = await fetch(`${materialsBase}/507f1f77bcf86cd799439011`, { headers: authHeader('accountant') });
  check('Get with a well-formed but unknown id returns 404', getMissingRes.status === 404);

  const getMalformedRes = await fetch(`${materialsBase}/not-an-object-id`, { headers: authHeader('accountant') });
  check('Get with a malformed id returns 400 (CastError)', getMalformedRes.status === 400);

  // 5. Update — RBAC + immutable quantityInStock
  console.log('\nUpdate material');
  const engineerUpdateRes = await fetch(`${materialsBase}/${materialId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader('site_engineer') },
    body: JSON.stringify({ unitPrice: 400 }),
  });
  check('Update as site_engineer returns 403', engineerUpdateRes.status === 403);

  const updateRes = await fetch(`${materialsBase}/${materialId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify({ unitPrice: 400, lowStockThreshold: 15 }),
  });
  const updateBody = await json(updateRes);
  check('Update as project_manager returns 200', updateRes.status === 200);
  check('Update applies new unitPrice', updateBody.data?.material?.unitPrice === 400);
  check('Update does not change quantityInStock (schema ignores it)', updateBody.data?.material?.quantityInStock === 20);

  // 6. Stock transactions
  console.log('\nStock transactions');
  const noAuthStockRes = await fetch(`${materialsBase}/${materialId}/stock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'in', quantity: 10 }),
  });
  check('Stock transaction without auth returns 401', noAuthStockRes.status === 401);

  const accountantStockRes = await fetch(`${materialsBase}/${materialId}/stock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('accountant') },
    body: JSON.stringify({ type: 'in', quantity: 10 }),
  });
  check('Stock transaction as accountant returns 403', accountantStockRes.status === 403);

  const stockInRes = await fetch(`${materialsBase}/${materialId}/stock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('site_engineer') },
    body: JSON.stringify({ type: 'in', quantity: 30, note: 'New delivery' }),
  });
  const stockInBody = await json(stockInRes);
  check('Stock-in as site_engineer returns 201 (can move stock)', stockInRes.status === 201);
  check('Stock-in increases quantityInStock (20 + 30 = 50)', stockInBody.data?.material?.quantityInStock === 50);

  const stockOutRes = await fetch(`${materialsBase}/${materialId}/stock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify({ type: 'out', quantity: 45, note: 'Used in Block A pour' }),
  });
  const stockOutBody = await json(stockOutRes);
  check('Stock-out returns 201', stockOutRes.status === 201);
  check('Stock-out decreases quantityInStock (50 - 45 = 5)', stockOutBody.data?.material?.quantityInStock === 5);
  check('Material now reports isLowStock=true (5 <= threshold 15)', stockOutBody.data?.material?.isLowStock === true);

  const insufficientStockRes = await fetch(`${materialsBase}/${materialId}/stock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify({ type: 'out', quantity: 999 }),
  });
  const insufficientStockBody = await json(insufficientStockRes);
  check('Stock-out exceeding available quantity returns 400', insufficientStockRes.status === 400);
  check(
    'Insufficient-stock error message reports the actual quantity on hand',
    insufficientStockBody.message?.includes('5'),
  );

  const badTypeRes = await fetch(`${materialsBase}/${materialId}/stock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify({ type: 'sideways', quantity: 5 }),
  });
  check('Stock transaction with an invalid type returns 400', badTypeRes.status === 400);

  const negativeQuantityRes = await fetch(`${materialsBase}/${materialId}/stock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify({ type: 'in', quantity: -5 }),
  });
  check('Stock transaction with a non-positive quantity returns 400', negativeQuantityRes.status === 400);

  // 7. Transaction history
  console.log('\nTransaction history');
  const transactionsRes = await fetch(`${materialsBase}/${materialId}/transactions`, {
    headers: authHeader('accountant'),
  });
  const transactionsBody = await json(transactionsRes);
  check('Get transaction history (read-only role) returns 200', transactionsRes.status === 200);
  check('Transaction history has both stock-in and stock-out entries (2)', transactionsBody.data?.transactions?.length === 2);
  check('Transaction history is sorted newest-first', transactionsBody.data?.transactions?.[0]?.note === 'Used in Block A pour');

  // 8. Delete — RBAC
  console.log('\nDelete material');
  const pmDeleteRes = await fetch(`${materialsBase}/${lowStockMaterialId}`, {
    method: 'DELETE',
    headers: authHeader('project_manager'),
  });
  check('Delete as project_manager returns 403 (super_admin only)', pmDeleteRes.status === 403);

  const adminDeleteRes = await fetch(`${materialsBase}/${lowStockMaterialId}`, {
    method: 'DELETE',
    headers: authHeader('super_admin'),
  });
  check('Delete as super_admin returns 200', adminDeleteRes.status === 200);

  const getAfterDeleteRes = await fetch(`${materialsBase}/${lowStockMaterialId}`, {
    headers: authHeader('super_admin'),
  });
  check('Get after delete returns 404', getAfterDeleteRes.status === 404);

  // Cleanup
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  console.log(`\n${'='.repeat(40)}`);
  console.log(`Phase 8 material test: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(40));

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('\nTest run crashed:', err);
  process.exit(1);
});
