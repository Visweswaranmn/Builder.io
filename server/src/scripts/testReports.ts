/**
 * Phase 14 smoke test — verifies the 4 report endpoints' computed data (not
 * just status codes) and that each supports CSV/Excel/PDF export alongside
 * the default JSON. Run with:
 *   npm run test:reports --workspace server
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import type { AddressInfo } from 'node:net';
import { createApp } from '../app.js';
import { UserModel } from '../models/user.model.js';
import { ProjectModel } from '../models/project.model.js';
import { EmployeeModel } from '../models/employee.model.js';
import { TaskModel } from '../models/task.model.js';
import { MaterialModel } from '../models/material.model.js';
import { ExpenseModel } from '../models/expense.model.js';
import { VendorModel } from '../models/vendor.model.js';

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
  const reportsBase = `http://127.0.0.1:${port}/api/v1/reports`;

  console.log('Seeding a realistic dataset');
  const pmUser = await UserModel.create({ name: 'PM User', email: 'pm@cpms.test', password: 'supersecret123', role: 'project_manager' });
  const engineerUser = await UserModel.create({ name: 'Engineer User', email: 'engineer@cpms.test', password: 'supersecret123', role: 'site_engineer' });
  const loginRes = await fetch(`${authBase}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'engineer@cpms.test', password: 'supersecret123' }),
  });
  const loginBody = await json(loginRes);
  const token = loginBody.data?.accessToken as string;
  check('Seed user logged in', typeof token === 'string');
  const authHeader = { Authorization: `Bearer ${token}` };

  const project = await ProjectModel.create({
    name: 'Skyline Tower', client: 'Acme', budget: 100_000, startDate: new Date('2026-01-01'), status: 'in_progress', progress: 40, manager: pmUser._id,
  });
  const vendor = await VendorModel.create({ name: 'BuildMart Supplies' });
  await EmployeeModel.create({
    name: 'Kumar Worker', department: 'civil', project: project._id, user: engineerUser._id, salary: 30000,
    attendance: [
      { date: new Date('2026-02-01'), status: 'present' },
      { date: new Date('2026-02-02'), status: 'present' },
      { date: new Date('2026-02-03'), status: 'absent' },
      { date: new Date('2026-02-04'), status: 'leave' },
    ],
  });
  await TaskModel.create({ title: 'Task A', project: project._id, status: 'todo' });
  await TaskModel.create({ title: 'Task B', project: project._id, status: 'completed' });
  await TaskModel.create({ title: 'Task C', project: project._id, status: 'completed' });
  await MaterialModel.create({
    name: 'OPC Cement', category: 'cement', unit: 'bag', quantityInStock: 20, lowStockThreshold: 30,
    unitPrice: 380, vendor: vendor._id, project: project._id,
    transactions: [
      { type: 'in', quantity: 50, date: new Date('2026-02-01') },
      { type: 'out', quantity: 30, date: new Date('2026-02-05') },
      { type: 'out', quantity: 20, date: new Date('2026-03-01') }, // outside Feb range in one filtered test
    ],
  });
  await ExpenseModel.create({ project: project._id, category: 'material', amount: 11400, vendor: vendor._id, recordedBy: pmUser._id, date: new Date('2026-02-01') });
  await ExpenseModel.create({ project: project._id, category: 'labour', amount: 20000, recordedBy: pmUser._id, date: new Date('2026-02-10') });

  // 1. Project report
  console.log('\nProject report');
  const noAuthRes = await fetch(`${reportsBase}/projects`);
  check('Project report without auth returns 401', noAuthRes.status === 401);

  const projectReportRes = await fetch(`${reportsBase}/projects`, { headers: authHeader });
  const projectReportBody = await json(projectReportRes);
  check('Project report (any authenticated role) returns 200', projectReportRes.status === 200);
  const projectRow = projectReportBody.data?.rows?.find((r: any) => r.name === 'Skyline Tower');
  check('Project row reports the correct actual expense (11400+20000=31400)', projectRow?.actualExpense === 31_400);
  check('Project row computes variance = budget - actual (100000-31400=68600)', projectRow?.variance === 68_600);
  check('Project row reports the correct manager name', projectRow?.managerName === 'PM User');
  check('Project row reports employeeCount = 1', projectRow?.employeeCount === 1);
  check('Project row breaks down task counts by status (todo:1, completed:2)', projectRow?.taskCounts?.todo === 1 && projectRow?.taskCounts?.completed === 2);

  const statusFilterRes = await fetch(`${reportsBase}/projects?status=completed`, { headers: authHeader });
  const statusFilterBody = await json(statusFilterRes);
  check('Status filter (completed) excludes the in_progress project', statusFilterBody.data?.rows?.length === 0);

  const badStatusRes = await fetch(`${reportsBase}/projects?status=not_a_status`, { headers: authHeader });
  check('Invalid status filter returns 400', badStatusRes.status === 400);

  // 2. Expense report
  console.log('\nExpense report');
  const expenseReportRes = await fetch(`${reportsBase}/expenses`, { headers: authHeader });
  const expenseReportBody = await json(expenseReportRes);
  check('Expense report returns 200', expenseReportRes.status === 200);
  check('Expense report returns both recorded expenses', expenseReportBody.data?.rows?.length === 2);
  check('Expense rows are populated with project/vendor/recordedBy names', expenseReportBody.data?.rows?.[0]?.projectName === 'Skyline Tower');
  check('Expense report includes a category summary (2 categories)', expenseReportBody.data?.summary?.byCategory?.length === 2);
  check('Expense report summary total is 31400', expenseReportBody.data?.summary?.total === 31_400);

  const categoryFilterRes = await fetch(`${reportsBase}/expenses?category=labour`, { headers: authHeader });
  const categoryFilterBody = await json(categoryFilterRes);
  check('Category filter narrows to 1 expense row', categoryFilterBody.data?.rows?.length === 1);

  // 3. Employee report
  console.log('\nEmployee report');
  const employeeReportRes = await fetch(`${reportsBase}/employees`, { headers: authHeader });
  const employeeReportBody = await json(employeeReportRes);
  check('Employee report returns 200', employeeReportRes.status === 200);
  const employeeRow = employeeReportBody.data?.rows?.[0];
  check('Employee row reports the correct project name', employeeRow?.projectName === 'Skyline Tower');
  check('Employee row counts attendance correctly (present:2, absent:1, leave:1)', employeeRow?.present === 2 && employeeRow?.absent === 1 && employeeRow?.leave === 1);

  const rangedAttendanceRes = await fetch(`${reportsBase}/employees?from=2026-02-01&to=2026-02-02`, { headers: authHeader });
  const rangedAttendanceBody = await json(rangedAttendanceRes);
  check(
    'Date-ranged attendance count reflects only Feb 1-2 (present:2, absent:0)',
    rangedAttendanceBody.data?.rows?.[0]?.present === 2 && rangedAttendanceBody.data?.rows?.[0]?.absent === 0,
  );

  // 4. Material report
  console.log('\nMaterial report');
  const materialReportRes = await fetch(`${reportsBase}/materials`, { headers: authHeader });
  const materialReportBody = await json(materialReportRes);
  check('Material report returns 200', materialReportRes.status === 200);
  const materialRow = materialReportBody.data?.rows?.[0];
  check('Material row computes stockValue (20*380=7600)', materialRow?.stockValue === 7_600);
  check('Material row reports isLowStock=true (20 <= threshold 30)', materialRow?.isLowStock === true);
  check('Material row sums ALL stock-in (50)', materialRow?.totalStockIn === 50);
  check('Material row sums ALL stock-out across both entries (30+20=50)', materialRow?.totalStockOut === 50);

  const rangedMaterialRes = await fetch(`${reportsBase}/materials?from=2026-02-01&to=2026-02-28`, { headers: authHeader });
  const rangedMaterialBody = await json(rangedMaterialRes);
  check(
    'Date-ranged material report excludes the March stock-out (totalStockOut=30, not 50)',
    rangedMaterialBody.data?.rows?.[0]?.totalStockOut === 30,
  );

  const lowStockOnlyRes = await fetch(`${reportsBase}/materials?lowStockOnly=true`, { headers: authHeader });
  const lowStockOnlyBody = await json(lowStockOnlyRes);
  check('lowStockOnly filter returns the 1 low-stock material', lowStockOnlyBody.data?.rows?.length === 1);

  // 5. Export formats
  console.log('\nExport formats');
  const csvRes = await fetch(`${reportsBase}/projects?format=csv`, { headers: authHeader });
  const csvText = await csvRes.text();
  check('CSV export returns 200', csvRes.status === 200);
  check('CSV export has the correct content type', csvRes.headers.get('content-type')?.includes('text/csv'));
  check('CSV export includes a header row and at least 1 data row', csvText.split('\r\n').length >= 2);
  check('CSV export includes the project name', csvText.includes('Skyline Tower'));

  const excelRes = await fetch(`${reportsBase}/expenses?format=excel`, { headers: authHeader });
  const excelBuffer = await excelRes.arrayBuffer();
  check('Excel export returns 200', excelRes.status === 200);
  check(
    'Excel export has the correct content type',
    excelRes.headers.get('content-type') === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  check('Excel export body is non-trivial (a real generated file)', excelBuffer.byteLength > 1000);

  const pdfRes = await fetch(`${reportsBase}/employees?format=pdf`, { headers: authHeader });
  const pdfBuffer = await pdfRes.arrayBuffer();
  check('PDF export returns 200', pdfRes.status === 200);
  check('PDF export has the correct content type', pdfRes.headers.get('content-type') === 'application/pdf');
  check('PDF export body is non-trivial', pdfBuffer.byteLength > 500);

  const materialPdfRes = await fetch(`${reportsBase}/materials?format=pdf`, { headers: authHeader });
  check('Material PDF export (12 columns, landscape layout) returns 200', materialPdfRes.status === 200);

  // Cleanup
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  console.log(`\n${'='.repeat(40)}`);
  console.log(`Phase 14 report test: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(40));

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('\nTest run crashed:', err);
  process.exit(1);
});
