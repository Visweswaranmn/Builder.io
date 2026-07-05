/**
 * Phase 4 smoke test — seeds sample data directly via models (Expense has no
 * write API yet — Phase 11 will add one; this only reads it) and verifies
 * the /api/v1/dashboard/summary aggregation math. Run with:
 *   npm run test:dashboard --workspace server
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
  const dashboardBase = `http://127.0.0.1:${port}/api/v1/dashboard`;

  console.log('Seeding sample data');
  const user = await UserModel.create({
    name: 'Dashboard Viewer',
    email: 'viewer@cpms.test',
    password: 'supersecret123',
    role: 'site_engineer', // any authenticated role should be able to read the summary
  });
  const loginRes = await fetch(`${authBase}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: 'supersecret123' }),
  });
  const loginBody = await json(loginRes);
  const token = loginBody.data?.accessToken as string;
  check('Seed user logged in with an access token', typeof token === 'string');

  // Projects: 2 active, 1 completed, 1 cancelled — only the 2 active count toward the card.
  const p1 = await ProjectModel.create({
    name: 'Skyline Tower', client: 'Acme', budget: 1_000_000, startDate: new Date(), status: 'in_progress', progress: 40,
  });
  await ProjectModel.create({
    name: 'Harbor View', client: 'Acme', budget: 500_000, startDate: new Date(), status: 'planning', progress: 5,
  });
  await ProjectModel.create({
    name: 'Old Depot', client: 'Acme', budget: 200_000, startDate: new Date(), status: 'completed', progress: 100,
  });
  await ProjectModel.create({
    name: 'Cancelled Job', client: 'Acme', budget: 300_000, startDate: new Date(), status: 'cancelled', progress: 0,
  });

  // Employees: 2 active, 1 inactive.
  await EmployeeModel.create({ name: 'Active One', isActive: true });
  await EmployeeModel.create({ name: 'Active Two', isActive: true });
  await EmployeeModel.create({ name: 'Inactive One', isActive: false });

  // Tasks: 2 pending (todo/in_progress), 1 completed.
  await TaskModel.create({ title: 'Task A', project: p1._id, status: 'todo' });
  await TaskModel.create({ title: 'Task B', project: p1._id, status: 'in_progress' });
  await TaskModel.create({ title: 'Task C', project: p1._id, status: 'completed' });

  // Materials with stock-out transactions (usage).
  await MaterialModel.create({
    name: 'OPC Cement', unit: 'bag',
    transactions: [{ type: 'in', quantity: 100 }, { type: 'out', quantity: 60 }, { type: 'out', quantity: 15 }],
  });
  await MaterialModel.create({
    name: 'TMT Steel', unit: 'ton',
    transactions: [{ type: 'in', quantity: 20 }, { type: 'out', quantity: 8 }],
  });

  // Expenses: one this month, one last month, one 8 months ago (outside the 6-month window).
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 15);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 10);
  const outOfWindow = new Date(now.getFullYear(), now.getMonth() - 8, 1);
  await ExpenseModel.create({ project: p1._id, category: 'material', amount: 20000, date: thisMonth });
  await ExpenseModel.create({ project: p1._id, category: 'labour', amount: 15000, date: thisMonth });
  await ExpenseModel.create({ project: p1._id, category: 'transport', amount: 5000, date: lastMonth });
  await ExpenseModel.create({ project: p1._id, category: 'other', amount: 99999, date: outOfWindow });

  console.log('\nDashboard summary');
  const noAuthRes = await fetch(`${dashboardBase}/summary`);
  check('Summary without auth returns 401', noAuthRes.status === 401);

  const res = await fetch(`${dashboardBase}/summary`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await json(res);
  check('Summary as a non-manager role (site_engineer) returns 200', res.status === 200);

  const cards = body.data?.cards;
  check('activeProjects counts only planning/in_progress/on_hold (2)', cards?.activeProjects === 2);
  check('totalEmployees counts only isActive=true (2)', cards?.totalEmployees === 2);
  check('pendingTasks counts non-completed tasks (2)', cards?.pendingTasks === 2);
  check(
    'totalBudget sums ALL project budgets regardless of status (1,000,000+500,000+200,000+300,000=2,000,000)',
    cards?.totalBudget === 2_000_000,
  );
  check(
    'totalExpenses sums ALL recorded expenses (20000+15000+5000+99999=139999)',
    cards?.totalExpenses === 139_999,
  );

  const charts = body.data?.charts;
  check('projectProgress includes all 4 seeded projects (limit 8)', charts?.projectProgress?.length === 4);
  check(
    'projectProgress reflects the correct progress value for the in-progress project',
    charts?.projectProgress?.find((p: any) => p.name === 'Skyline Tower')?.progress === 40,
  );

  check('monthlyExpenses always returns exactly 6 months', charts?.monthlyExpenses?.length === 6);
  const monthTotals = (charts?.monthlyExpenses ?? []).map((m: any) => m.total);
  check(
    'monthlyExpenses excludes the 8-months-ago expense from the 6-month window (sum=40000, not 139999)',
    monthTotals.reduce((a: number, b: number) => a + b, 0) === 40_000,
  );
  check('The current month total is 35000 (20000+15000)', monthTotals[monthTotals.length - 1] === 35_000);
  check('The previous month total is 5000', monthTotals[monthTotals.length - 2] === 5_000);

  check('materialUsage includes both materials (2)', charts?.materialUsage?.length === 2);
  const cementUsage = charts?.materialUsage?.find((m: any) => m.name === 'OPC Cement');
  check('materialUsage sums only stock-OUT quantity for cement (60+15=75, ignoring the 100 stock-in)', cementUsage?.used === 75);
  check('materialUsage is sorted with the highest usage first', charts?.materialUsage?.[0]?.name === 'OPC Cement');

  // Cleanup
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  console.log(`\n${'='.repeat(40)}`);
  console.log(`Phase 4 dashboard test: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(40));

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('\nTest run crashed:', err);
  process.exit(1);
});
