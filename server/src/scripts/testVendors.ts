/**
 * Phase 9 smoke test — drives the real Express app's /vendors CRUD +
 * purchase-order + payment endpoints over HTTP. Covers RBAC (including the
 * accountant's payment-recording permission), balance/status bookkeeping,
 * PO status-transition rules, and edge cases. Run with:
 *   npm run test:vendors --workspace server
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
  const vendorsBase = `http://127.0.0.1:${port}/api/v1/vendors`;

  console.log('Seeding users per role');
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

  const authHeader = (role: UserRole) => ({ Authorization: `Bearer ${roleUsers[role].token}` });

  // 1. Create — RBAC + validation
  console.log('\nCreate vendor (RBAC)');
  const validPayload = {
    name: 'BuildMart Supplies',
    companyName: 'BuildMart Pvt Ltd',
    phone: '9990001234',
    materialsSupplied: ['cement', 'steel'],
  };

  const noAuthRes = await fetch(vendorsBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validPayload),
  });
  check('Create without auth returns 401', noAuthRes.status === 401);

  const engineerCreateRes = await fetch(vendorsBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('site_engineer') },
    body: JSON.stringify(validPayload),
  });
  check('Create as site_engineer returns 403', engineerCreateRes.status === 403);

  const accountantCreateRes = await fetch(vendorsBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('accountant') },
    body: JSON.stringify(validPayload),
  });
  check('Create as accountant returns 403 (finance role, not vendor management)', accountantCreateRes.status === 403);

  const pmCreateRes = await fetch(vendorsBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify(validPayload),
  });
  const pmCreateBody = await json(pmCreateRes);
  check('Create as project_manager returns 201', pmCreateRes.status === 201);
  check('Created vendor defaults paymentStatus to pending', pmCreateBody.data?.vendor?.paymentStatus === 'pending');
  check('Created vendor defaults outstandingBalance to 0', pmCreateBody.data?.vendor?.outstandingBalance === 0);
  const vendorId = pmCreateBody.data?.vendor?._id as string;

  const missingNameRes = await fetch(vendorsBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ companyName: 'No Name Co' }),
  });
  check('Create with missing required name returns 400', missingNameRes.status === 400);

  // 2. List + filtering
  console.log('\nList vendors');
  const listNoAuthRes = await fetch(vendorsBase);
  check('List without auth returns 401', listNoAuthRes.status === 401);

  const listRes = await fetch(vendorsBase, { headers: authHeader('site_engineer') });
  const listBody = await json(listRes);
  check('List as site_engineer (read-only role) returns 200', listRes.status === 200);
  check('List returns the 1 created vendor', listBody.data?.vendors?.length === 1);

  const searchRes = await fetch(`${vendorsBase}?search=BuildMart`, { headers: authHeader('accountant') });
  const searchBody = await json(searchRes);
  check('Search by name filters to 1 matching vendor', searchBody.data?.vendors?.length === 1);

  const badStatusFilterRes = await fetch(`${vendorsBase}?paymentStatus=not_a_status`, {
    headers: authHeader('accountant'),
  });
  check('Invalid paymentStatus filter returns 400', badStatusFilterRes.status === 400);

  // 3. Get by id
  console.log('\nGet vendor by id');
  const getRes = await fetch(`${vendorsBase}/${vendorId}`, { headers: authHeader('accountant') });
  const getBody = await json(getRes);
  check('Get existing vendor returns 200', getRes.status === 200);
  check('Get returns the correct vendor', getBody.data?.vendor?.name === 'BuildMart Supplies');

  const getMissingRes = await fetch(`${vendorsBase}/507f1f77bcf86cd799439011`, { headers: authHeader('accountant') });
  check('Get with a well-formed but unknown id returns 404', getMissingRes.status === 404);

  const getMalformedRes = await fetch(`${vendorsBase}/not-an-object-id`, { headers: authHeader('accountant') });
  check('Get with a malformed id returns 400 (CastError)', getMalformedRes.status === 400);

  // 4. Update — RBAC
  console.log('\nUpdate vendor');
  const engineerUpdateRes = await fetch(`${vendorsBase}/${vendorId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader('site_engineer') },
    body: JSON.stringify({ phone: '8880002222' }),
  });
  check('Update as site_engineer returns 403', engineerUpdateRes.status === 403);

  const updateRes = await fetch(`${vendorsBase}/${vendorId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify({ phone: '8880002222' }),
  });
  const updateBody = await json(updateRes);
  check('Update as project_manager returns 200', updateRes.status === 200);
  check('Update applies new phone', updateBody.data?.vendor?.phone === '8880002222');

  // 5. Purchase orders
  console.log('\nPurchase orders');
  const noAuthPoRes = await fetch(`${vendorsBase}/${vendorId}/purchase-orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: '50 bags cement', amount: 19000 }),
  });
  check('Create PO without auth returns 401', noAuthPoRes.status === 401);

  const engineerPoRes = await fetch(`${vendorsBase}/${vendorId}/purchase-orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('site_engineer') },
    body: JSON.stringify({ description: '50 bags cement', amount: 19000 }),
  });
  check('Create PO as site_engineer returns 403', engineerPoRes.status === 403);

  const poRes = await fetch(`${vendorsBase}/${vendorId}/purchase-orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify({ description: '50 bags cement', amount: 19000 }),
  });
  const poBody = await json(poRes);
  check('Create PO as project_manager returns 201', poRes.status === 201);
  check('PO amount increases outstandingBalance', poBody.data?.vendor?.outstandingBalance === 19000);
  check('Vendor paymentStatus flips to pending with a nonzero balance', poBody.data?.vendor?.paymentStatus === 'pending');
  const poId = poBody.data?.vendor?.purchaseOrders?.[0]?._id as string;

  const secondPoRes = await fetch(`${vendorsBase}/${vendorId}/purchase-orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ description: '10 tons steel', amount: 55000 }),
  });
  const secondPoBody = await json(secondPoRes);
  check('Second PO adds onto the outstanding balance (19000+55000)', secondPoBody.data?.vendor?.outstandingBalance === 74000);
  const secondPoId = secondPoBody.data?.vendor?.purchaseOrders?.find((p: any) => p.description === '10 tons steel')?._id as string;

  const missingDescRes = await fetch(`${vendorsBase}/${vendorId}/purchase-orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ amount: 100 }),
  });
  check('Create PO with missing description returns 400', missingDescRes.status === 400);

  const listPoRes = await fetch(`${vendorsBase}/${vendorId}/purchase-orders`, { headers: authHeader('accountant') });
  const listPoBody = await json(listPoRes);
  check('List purchase orders (read-only role) returns 200', listPoRes.status === 200);
  check('List purchase orders returns both POs', listPoBody.data?.purchaseOrders?.length === 2);

  const pendingFilterRes = await fetch(`${vendorsBase}/${vendorId}/purchase-orders?status=pending`, {
    headers: authHeader('accountant'),
  });
  const pendingFilterBody = await json(pendingFilterRes);
  check('Purchase order status filter returns both (still pending)', pendingFilterBody.data?.purchaseOrders?.length === 2);

  // 6. Purchase order status transitions
  console.log('\nPurchase order status transitions');
  const engineerStatusRes = await fetch(`${vendorsBase}/${vendorId}/purchase-orders/${poId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader('site_engineer') },
    body: JSON.stringify({ status: 'ordered' }),
  });
  check('Update PO status as site_engineer returns 403', engineerStatusRes.status === 403);

  const toOrderedRes = await fetch(`${vendorsBase}/${vendorId}/purchase-orders/${poId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify({ status: 'ordered' }),
  });
  check('pending -> ordered transition returns 200', toOrderedRes.status === 200);

  const invalidSkipRes = await fetch(`${vendorsBase}/${vendorId}/purchase-orders/${poId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify({ status: 'pending' }),
  });
  check('ordered -> pending (backwards) transition returns 400', invalidSkipRes.status === 400);

  const toDeliveredRes = await fetch(`${vendorsBase}/${vendorId}/purchase-orders/${poId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify({ status: 'delivered' }),
  });
  const toDeliveredBody = await json(toDeliveredRes);
  check('ordered -> delivered transition returns 200', toDeliveredRes.status === 200);
  const deliveredPo = toDeliveredBody.data?.vendor?.purchaseOrders?.find((p: any) => p._id === poId);
  check('Delivered PO gets a deliveredDate stamp', Boolean(deliveredPo?.deliveredDate));

  const modifyDeliveredRes = await fetch(`${vendorsBase}/${vendorId}/purchase-orders/${poId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify({ status: 'cancelled' }),
  });
  check('Modifying an already-delivered PO returns 400 (terminal state)', modifyDeliveredRes.status === 400);

  const cancelRes = await fetch(`${vendorsBase}/${vendorId}/purchase-orders/${secondPoId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ status: 'cancelled' }),
  });
  const cancelBody = await json(cancelRes);
  check('Cancelling a pending PO returns 200', cancelRes.status === 200);
  check(
    'Cancelling reverses the amount out of outstandingBalance (74000 - 55000 = 19000)',
    cancelBody.data?.vendor?.outstandingBalance === 19000,
  );

  const badPoIdRes = await fetch(`${vendorsBase}/${vendorId}/purchase-orders/507f1f77bcf86cd799439011`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ status: 'ordered' }),
  });
  check('Updating a non-existent PO id returns 404', badPoIdRes.status === 404);

  // 7. Payments — accountant permission
  console.log('\nPayments (accountant permission)');
  const noAuthPaymentRes = await fetch(`${vendorsBase}/${vendorId}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 5000 }),
  });
  check('Record payment without auth returns 401', noAuthPaymentRes.status === 401);

  const pmPaymentRes = await fetch(`${vendorsBase}/${vendorId}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify({ amount: 5000 }),
  });
  check(
    'Record payment as project_manager returns 403 (finance is accountant/super_admin only)',
    pmPaymentRes.status === 403,
  );

  const accountantPaymentRes = await fetch(`${vendorsBase}/${vendorId}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('accountant') },
    body: JSON.stringify({ amount: 9000, method: 'upi', note: 'Partial settlement' }),
  });
  const accountantPaymentBody = await json(accountantPaymentRes);
  check('Record payment as accountant returns 201', accountantPaymentRes.status === 201);
  check(
    'Payment reduces outstandingBalance (19000 - 9000 = 10000)',
    accountantPaymentBody.data?.vendor?.outstandingBalance === 10000,
  );
  check('Vendor paymentStatus becomes partial', accountantPaymentBody.data?.vendor?.paymentStatus === 'partial');

  const overpayRes = await fetch(`${vendorsBase}/${vendorId}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('accountant') },
    body: JSON.stringify({ amount: 99999 }),
  });
  check('Payment exceeding the outstanding balance returns 400', overpayRes.status === 400);

  const finalPaymentRes = await fetch(`${vendorsBase}/${vendorId}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ amount: 10000, method: 'bank_transfer' }),
  });
  const finalPaymentBody = await json(finalPaymentRes);
  check('Final payment as super_admin returns 201', finalPaymentRes.status === 201);
  check('Fully settling the balance sets outstandingBalance to 0', finalPaymentBody.data?.vendor?.outstandingBalance === 0);
  check('Vendor paymentStatus becomes paid', finalPaymentBody.data?.vendor?.paymentStatus === 'paid');

  const listPaymentsRes = await fetch(`${vendorsBase}/${vendorId}/payments`, { headers: authHeader('site_engineer') });
  const listPaymentsBody = await json(listPaymentsRes);
  check('List payments (read-only role) returns 200', listPaymentsRes.status === 200);
  check('List payments returns both recorded payments', listPaymentsBody.data?.payments?.length === 2);

  // 8. Delete — RBAC
  console.log('\nDelete vendor');
  const pmDeleteRes = await fetch(`${vendorsBase}/${vendorId}`, {
    method: 'DELETE',
    headers: authHeader('project_manager'),
  });
  check('Delete as project_manager returns 403 (super_admin only)', pmDeleteRes.status === 403);

  const adminDeleteRes = await fetch(`${vendorsBase}/${vendorId}`, {
    method: 'DELETE',
    headers: authHeader('super_admin'),
  });
  check('Delete as super_admin returns 200', adminDeleteRes.status === 200);

  const getAfterDeleteRes = await fetch(`${vendorsBase}/${vendorId}`, { headers: authHeader('super_admin') });
  check('Get after delete returns 404', getAfterDeleteRes.status === 404);

  // Cleanup
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  console.log(`\n${'='.repeat(40)}`);
  console.log(`Phase 9 vendor test: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(40));

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('\nTest run crashed:', err);
  process.exit(1);
});
