/**
 * Phase 12 smoke test — drives the real Express app's /invoices CRUD +
 * status workflow + payments + PDF endpoints over HTTP. Covers RBAC,
 * server-computed GST/totals, invoice-number generation, the payment/status
 * state machine, and PDF downloads. Run with:
 *   npm run test:invoices --workspace server
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
  const invoicesBase = `http://127.0.0.1:${port}/api/v1/invoices`;

  console.log('Seeding users and a project');
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
    name: 'Skyline Tower', client: 'Acme Developers', budget: 1_000_000, startDate: new Date(),
  });

  const authHeader = (role: UserRole) => ({ Authorization: `Bearer ${roleUsers[role].token}` });

  // 1. Create — RBAC + server-computed totals
  console.log('\nCreate invoice (RBAC + GST computation)');
  const validPayload = {
    project: project._id.toString(),
    client: 'Acme Developers',
    items: [
      { description: 'Milestone 1', quantity: 1, unitPrice: 100_000 },
      { description: 'Site survey', quantity: 2, unitPrice: 5_000 },
    ],
    gstRate: 18,
  };

  const noAuthRes = await fetch(invoicesBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validPayload),
  });
  check('Create without auth returns 401', noAuthRes.status === 401);

  const engineerCreateRes = await fetch(invoicesBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('site_engineer') },
    body: JSON.stringify(validPayload),
  });
  check('Create as site_engineer returns 403', engineerCreateRes.status === 403);

  const pmCreateRes = await fetch(invoicesBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify(validPayload),
  });
  const pmCreateBody = await json(pmCreateRes);
  check('Create as project_manager returns 201', pmCreateRes.status === 201);
  check('Invoice number is auto-generated in INV-<year>-#### format', /^INV-\d{4}-\d{4}$/.test(pmCreateBody.data?.invoice?.invoiceNumber ?? ''));
  check('Subtotal is computed from items (100000 + 2*5000 = 110000)', pmCreateBody.data?.invoice?.subtotal === 110_000);
  check('GST amount is computed at 18% of subtotal (19800)', pmCreateBody.data?.invoice?.gstAmount === 19_800);
  check('Total is subtotal + GST (129800)', pmCreateBody.data?.invoice?.total === 129_800);
  check('New invoice defaults to draft status', pmCreateBody.data?.invoice?.status === 'draft');
  check('Invoice project is populated with a name', pmCreateBody.data?.invoice?.project?.name === 'Skyline Tower');
  const invoiceId = pmCreateBody.data?.invoice?._id as string;
  const invoiceNumber = pmCreateBody.data?.invoice?.invoiceNumber as string;

  const secondCreateRes = await fetch(invoicesBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('accountant') },
    body: JSON.stringify({ project: project._id.toString(), client: 'Acme Developers', items: [{ description: 'Milestone 2', quantity: 1, unitPrice: 50_000 }] }),
  });
  const secondCreateBody = await json(secondCreateRes);
  check('Create as accountant returns 201', secondCreateRes.status === 201);
  check(
    'Auto-generated invoice numbers are sequential and distinct',
    secondCreateBody.data?.invoice?.invoiceNumber !== invoiceNumber,
  );

  const explicitNumberRes = await fetch(invoicesBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ invoiceNumber: 'CUSTOM-001', project: project._id.toString(), client: 'X', items: [{ description: 'A', quantity: 1, unitPrice: 10 }] }),
  });
  check('Create with an explicit invoiceNumber returns 201', explicitNumberRes.status === 201);

  const duplicateNumberRes = await fetch(invoicesBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ invoiceNumber: 'CUSTOM-001', project: project._id.toString(), client: 'X', items: [{ description: 'A', quantity: 1, unitPrice: 10 }] }),
  });
  check('Create with a duplicate explicit invoiceNumber returns 409', duplicateNumberRes.status === 409);

  // 2. Validation
  console.log('\nValidation');
  const noItemsRes = await fetch(invoicesBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ project: project._id.toString(), client: 'X', items: [] }),
  });
  check('Create with an empty items array returns 400', noItemsRes.status === 400);

  const badProjectRes = await fetch(invoicesBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ project: '507f1f77bcf86cd799439011', client: 'X', items: [{ description: 'A', quantity: 1, unitPrice: 10 }] }),
  });
  check('Create with a non-existent project id returns 400', badProjectRes.status === 400);

  const negativeQtyRes = await fetch(invoicesBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ project: project._id.toString(), client: 'X', items: [{ description: 'A', quantity: -1, unitPrice: 10 }] }),
  });
  check('Create with a non-positive quantity returns 400', negativeQtyRes.status === 400);

  const tamperedAmountRes = await fetch(invoicesBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ project: project._id.toString(), client: 'X', items: [{ description: 'A', quantity: 1, unitPrice: 10, amount: 999999 }] }),
  });
  const tamperedAmountBody = await json(tamperedAmountRes);
  check(
    'A client-supplied "amount" on a line item is ignored — recomputed as quantity*unitPrice (10, not 999999)',
    tamperedAmountBody.data?.invoice?.items?.[0]?.amount === 10,
  );

  // 3. List + filtering
  console.log('\nList invoices');
  const listNoAuthRes = await fetch(invoicesBase);
  check('List without auth returns 401', listNoAuthRes.status === 401);

  const listRes = await fetch(invoicesBase, { headers: authHeader('site_engineer') });
  const listBody = await json(listRes);
  check('List as site_engineer (read-only role) returns 200', listRes.status === 200);
  check('List returns all 4 created invoices', listBody.data?.invoices?.length === 4);

  const clientFilterRes = await fetch(`${invoicesBase}?client=Acme`, { headers: authHeader('site_engineer') });
  const clientFilterBody = await json(clientFilterRes);
  check('Client filter narrows to 2 matching invoices', clientFilterBody.data?.invoices?.length === 2);

  const outstandingRes = await fetch(`${invoicesBase}?outstandingOnly=true`, { headers: authHeader('site_engineer') });
  const outstandingBody = await json(outstandingRes);
  check('outstandingOnly returns all 4 (none paid yet)', outstandingBody.data?.invoices?.length === 4);

  // 4. Get by id
  console.log('\nGet invoice by id');
  const getRes = await fetch(`${invoicesBase}/${invoiceId}`, { headers: authHeader('site_engineer') });
  const getBody = await json(getRes);
  check('Get existing invoice returns 200', getRes.status === 200);
  check('Get returns the correct invoice', getBody.data?.invoice?.client === 'Acme Developers');

  const getMissingRes = await fetch(`${invoicesBase}/507f1f77bcf86cd799439011`, { headers: authHeader('site_engineer') });
  check('Get with a well-formed but unknown id returns 404', getMissingRes.status === 404);

  const getMalformedRes = await fetch(`${invoicesBase}/not-an-object-id`, { headers: authHeader('site_engineer') });
  check('Get with a malformed id returns 400 (CastError)', getMalformedRes.status === 400);

  // 5. Update — recompute totals
  console.log('\nUpdate invoice');
  const engineerUpdateRes = await fetch(`${invoicesBase}/${invoiceId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader('site_engineer') },
    body: JSON.stringify({ client: 'Changed' }),
  });
  check('Update as site_engineer returns 403', engineerUpdateRes.status === 403);

  const updateRes = await fetch(`${invoicesBase}/${invoiceId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader('accountant') },
    body: JSON.stringify({ items: [{ description: 'Revised milestone', quantity: 1, unitPrice: 200_000 }], gstRate: 10 }),
  });
  const updateBody = await json(updateRes);
  check('Update as accountant returns 200', updateRes.status === 200);
  check('Update recomputes subtotal from the new items (200000)', updateBody.data?.invoice?.subtotal === 200_000);
  check('Update recomputes GST at the new rate (10% = 20000)', updateBody.data?.invoice?.gstAmount === 20_000);
  check('Update recomputes total (220000)', updateBody.data?.invoice?.total === 220_000);

  // 6. Status workflow
  console.log('\nStatus workflow');
  const invalidStatusRes = await fetch(`${invoicesBase}/${invoiceId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader('accountant') },
    body: JSON.stringify({ status: 'paid' }),
  });
  check('Manually setting status to "paid" is rejected by validation (400)', invalidStatusRes.status === 400);

  const engineerStatusRes = await fetch(`${invoicesBase}/${invoiceId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader('site_engineer') },
    body: JSON.stringify({ status: 'sent' }),
  });
  check('Status update as site_engineer returns 403', engineerStatusRes.status === 403);

  const sendRes = await fetch(`${invoicesBase}/${invoiceId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify({ status: 'sent' }),
  });
  const sendBody = await json(sendRes);
  check('draft -> sent transition returns 200', sendRes.status === 200);
  check('Status is now "sent"', sendBody.data?.invoice?.status === 'sent');

  // 7. Payments
  console.log('\nPayments');
  const pmPaymentRes = await fetch(`${invoicesBase}/${invoiceId}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify({ amount: 50_000 }),
  });
  check(
    'Record payment as project_manager returns 403 (finance is accountant/super_admin only)',
    pmPaymentRes.status === 403,
  );

  const partialPaymentRes = await fetch(`${invoicesBase}/${invoiceId}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('accountant') },
    body: JSON.stringify({ amount: 100_000, method: 'bank_transfer' }),
  });
  const partialPaymentBody = await json(partialPaymentRes);
  check('Partial payment as accountant returns 201', partialPaymentRes.status === 201);
  check(
    'Invoice auto-transitions to partially_paid (100000 of 220000 paid)',
    partialPaymentBody.data?.invoice?.status === 'partially_paid',
  );
  check('balanceDue virtual reflects the remaining amount (120000)', partialPaymentBody.data?.invoice?.balanceDue === 120_000);

  const overpayRes = await fetch(`${invoicesBase}/${invoiceId}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('accountant') },
    body: JSON.stringify({ amount: 999_999 }),
  });
  check('Payment exceeding the outstanding balance returns 400', overpayRes.status === 400);

  const finalPaymentRes = await fetch(`${invoicesBase}/${invoiceId}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ amount: 120_000, reference: 'FINAL-PMT' }),
  });
  const finalPaymentBody = await json(finalPaymentRes);
  check('Final payment as super_admin returns 201', finalPaymentRes.status === 201);
  check('Invoice auto-transitions to paid once fully settled', finalPaymentBody.data?.invoice?.status === 'paid');
  check('balanceDue is now 0', finalPaymentBody.data?.invoice?.balanceDue === 0);

  const paymentOnPaidRes = await fetch(`${invoicesBase}/${invoiceId}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('accountant') },
    body: JSON.stringify({ amount: 1 }),
  });
  check('A further payment on a fully-paid (zero-balance) invoice returns 400', paymentOnPaidRes.status === 400);

  const revertPaidRes = await fetch(`${invoicesBase}/${invoiceId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ status: 'sent' }),
  });
  check('Reverting a paid invoice back to "sent" is rejected (400)', revertPaidRes.status === 400);

  const listPaymentsRes = await fetch(`${invoicesBase}/${invoiceId}/payments`, { headers: authHeader('site_engineer') });
  const listPaymentsBody = await json(listPaymentsRes);
  check('List payments (read-only role) returns 200', listPaymentsRes.status === 200);
  check('List payments returns both recorded payments', listPaymentsBody.data?.payments?.length === 2);

  // 8. Cancelled invoice guard
  console.log('\nCancelled invoice guard');
  const cancelRes = await fetch(`${invoicesBase}/${secondCreateBody.data?.invoice?._id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ status: 'cancelled' }),
  });
  check('draft -> cancelled transition returns 200', cancelRes.status === 200);

  const paymentOnCancelledRes = await fetch(`${invoicesBase}/${secondCreateBody.data?.invoice?._id}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('accountant') },
    body: JSON.stringify({ amount: 100 }),
  });
  check('Payment on a cancelled invoice returns 400', paymentOnCancelledRes.status === 400);

  const statusOnCancelledRes = await fetch(`${invoicesBase}/${secondCreateBody.data?.invoice?._id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader('super_admin') },
    body: JSON.stringify({ status: 'sent' }),
  });
  check('Further status change on a cancelled invoice returns 400', statusOnCancelledRes.status === 400);

  // 9. PDF downloads
  console.log('\nPDF downloads');
  const pdfRes = await fetch(`${invoicesBase}/${invoiceId}/pdf`, { headers: authHeader('site_engineer') });
  const pdfBuffer = await pdfRes.arrayBuffer();
  check('Invoice PDF download returns 200', pdfRes.status === 200);
  check('Invoice PDF has the correct content type', pdfRes.headers.get('content-type') === 'application/pdf');
  check('Invoice PDF body is non-trivial (a real generated file)', pdfBuffer.byteLength > 500);

  const receiptRes = await fetch(`${invoicesBase}/${invoiceId}/payments/0/receipt`, { headers: authHeader('site_engineer') });
  const receiptBuffer = await receiptRes.arrayBuffer();
  check('Receipt PDF download returns 200', receiptRes.status === 200);
  check('Receipt PDF body is non-trivial', receiptBuffer.byteLength > 200);

  const missingReceiptRes = await fetch(`${invoicesBase}/${invoiceId}/payments/99/receipt`, { headers: authHeader('site_engineer') });
  check('Receipt for a non-existent payment index returns 404', missingReceiptRes.status === 404);

  // 10. Delete — RBAC
  console.log('\nDelete invoice');
  const accountantDeleteRes = await fetch(`${invoicesBase}/${invoiceId}`, {
    method: 'DELETE',
    headers: authHeader('accountant'),
  });
  check('Delete as accountant returns 403 (super_admin only)', accountantDeleteRes.status === 403);

  const adminDeleteRes = await fetch(`${invoicesBase}/${invoiceId}`, {
    method: 'DELETE',
    headers: authHeader('super_admin'),
  });
  check('Delete as super_admin returns 200', adminDeleteRes.status === 200);

  const getAfterDeleteRes = await fetch(`${invoicesBase}/${invoiceId}`, { headers: authHeader('super_admin') });
  check('Get after delete returns 404', getAfterDeleteRes.status === 404);

  // Cleanup
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  console.log(`\n${'='.repeat(40)}`);
  console.log(`Phase 12 invoice test: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(40));

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('\nTest run crashed:', err);
  process.exit(1);
});
