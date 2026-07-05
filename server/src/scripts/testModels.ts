/**
 * Phase 2 smoke test — exercises every model and the relationships between them
 * against an isolated test database, then drops it. Run with:
 *   npm run test:models --workspace server
 *
 * This is intentionally dependency-free (no test runner yet) so Phase 2 can be
 * verified end-to-end before controllers exist. A real Jest/Vitest suite lands
 * alongside the API routes.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import {
  UserModel,
  ProjectModel,
  EmployeeModel,
  TaskModel,
  VendorModel,
  MaterialModel,
  ExpenseModel,
  InvoiceModel,
  DailyReportModel,
  NotificationModel,
} from '../models/index.js';

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

async function run(): Promise<void> {
  console.log(`\nConnecting to test DB: ${TEST_URI}`);
  await mongoose.connect(TEST_URI);
  await mongoose.connection.dropDatabase();
  console.log('Test DB reset.\n');

  // 1. Users
  console.log('Users & roles');
  const manager = await UserModel.create({
    name: 'Priya Manager',
    email: 'priya@cpms.test',
    password: 'supersecret123',
    role: 'project_manager',
  });
  const engineer = await UserModel.create({
    name: 'Ravi Engineer',
    email: 'ravi@cpms.test',
    password: 'supersecret123',
    role: 'site_engineer',
  });
  check('User created with role', manager.role === 'project_manager');
  const leaked = await UserModel.findById(manager._id);
  check('password is not selected by default', leaked?.password === undefined);
  check('password IS retrievable with explicit select', Boolean(
    (await UserModel.findById(manager._id).select('+password'))?.password,
  ));

  // 2. Project references a manager
  console.log('\nProjects');
  const project = await ProjectModel.create({
    name: 'Skyline Tower',
    client: 'Acme Developers',
    budget: 5_000_000,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    location: 'Chennai',
    manager: manager._id,
  });
  check('Project created', project.name === 'Skyline Tower');

  console.log('  validating endDate < startDate is rejected...');
  let dateRejected = false;
  try {
    await ProjectModel.create({
      name: 'Bad Dates',
      client: 'X',
      budget: 1,
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-04-01'),
    });
  } catch {
    dateRejected = true;
  }
  check('Project rejects end date before start date', dateRejected);

  console.log('  validating invalid status enum is rejected...');
  let enumRejected = false;
  try {
    // 'nonsense' is not a valid ProjectStatus — schema enum validation should reject it.
    await ProjectModel.create({
      name: 'X',
      client: 'Y',
      budget: 1,
      startDate: new Date(),
      status: 'nonsense' as never,
    });
  } catch {
    enumRejected = true;
  }
  check('Project rejects invalid status enum', enumRejected);

  // 3. Employee assigned to project + manager, with attendance subdoc
  console.log('\nEmployees & attendance');
  const employee = await EmployeeModel.create({
    name: 'Kumar Worker',
    department: 'civil',
    designation: 'Mason',
    salary: 35000,
    project: project._id,
    manager: manager._id,
    user: engineer._id,
    attendance: [{ date: new Date(), status: 'present' }],
  });
  check('Employee created with embedded attendance', employee.attendance.length === 1);

  // 4. Task references project, employee, user
  console.log('\nTasks');
  const task = await TaskModel.create({
    title: 'Pour foundation - Block A',
    project: project._id,
    assignedTo: employee._id,
    assignedBy: manager._id,
    priority: 'high',
    deadline: new Date('2026-02-15'),
  });
  check('Task created', task.status === 'todo');
  task.status = 'completed';
  await task.save();
  check('Completing a task forces progress=100 (pre-save hook)', task.progress === 100);
  check('Completing a task stamps completedAt', task.completedAt instanceof Date);

  // 5. Vendor + Material (with low-stock virtual)
  console.log('\nVendors & materials');
  const vendor = await VendorModel.create({
    name: 'BuildMart Supplies',
    companyName: 'BuildMart Pvt Ltd',
    phone: '9990001234',
    materialsSupplied: ['cement', 'steel'],
  });
  const material = await MaterialModel.create({
    name: 'OPC Cement 53 Grade',
    category: 'cement',
    unit: 'bag',
    quantityInStock: 8,
    lowStockThreshold: 10,
    unitPrice: 380,
    vendor: vendor._id,
    project: project._id,
    transactions: [{ type: 'in', quantity: 50 }, { type: 'out', quantity: 42 }],
  });
  check('Material created with stock transactions', material.transactions.length === 2);
  check('isLowStock virtual reflects quantity <= threshold', material.get('isLowStock') === true);

  // 6. Expense against project
  console.log('\nExpenses');
  const expense = await ExpenseModel.create({
    project: project._id,
    category: 'material',
    amount: 15960,
    description: 'Cement purchase',
    vendor: vendor._id,
    material: material._id,
    recordedBy: manager._id,
  });
  check('Expense created', expense.amount === 15960);

  // 7. Invoice with GST + payment virtuals
  console.log('\nInvoices');
  const invoice = await InvoiceModel.create({
    invoiceNumber: 'INV-2026-0001',
    project: project._id,
    client: 'Acme Developers',
    items: [{ description: 'Milestone 1', quantity: 1, unitPrice: 1_000_000, amount: 1_000_000 }],
    subtotal: 1_000_000,
    gstRate: 18,
    gstAmount: 180_000,
    total: 1_180_000,
    status: 'sent',
    payments: [{ amount: 500_000, method: 'bank_transfer' }],
  });
  check('Invoice amountPaid virtual sums payments', invoice.get('amountPaid') === 500_000);
  check('Invoice balanceDue virtual = total - paid', invoice.get('balanceDue') === 680_000);

  console.log('  validating unique invoiceNumber constraint...');
  await InvoiceModel.syncIndexes();
  let dupRejected = false;
  try {
    await InvoiceModel.create({
      invoiceNumber: 'INV-2026-0001',
      project: project._id,
      client: 'Acme',
      subtotal: 1,
      total: 1,
    });
  } catch {
    dupRejected = true;
  }
  check('Invoice rejects duplicate invoiceNumber (unique index)', dupRejected);

  // 8. Daily report
  console.log('\nDaily reports');
  const report = await DailyReportModel.create({
    project: project._id,
    engineer: engineer._id,
    workDone: 'Completed rebar tying for Block A footing.',
    progressPercentage: 35,
    laborCount: 24,
    weather: 'Sunny',
    issues: [{ description: 'Water logging near gate', severity: 'medium' }],
  });
  check('Daily report created with issues', report.issues.length === 1);

  // 9. Notification
  console.log('\nNotifications');
  const notification = await NotificationModel.create({
    recipient: manager._id,
    type: 'material_low',
    title: 'Low stock alert',
    message: 'OPC Cement 53 Grade is below threshold (8 bags).',
    relatedEntity: { model: 'Material', id: material._id },
  });
  check('Notification created', notification.isRead === false);

  // 10. Relationship population across collections
  console.log('\nRelationship population');
  const populatedProject = await ProjectModel.findById(project._id).populate('manager');
  check('Project.manager populates to a User', (populatedProject?.manager as { name?: string } | null)?.name === 'Priya Manager');

  const populatedTask = await TaskModel.findById(task._id)
    .populate('project')
    .populate('assignedTo');
  check('Task.project populates', (populatedTask?.project as { name?: string } | null)?.name === 'Skyline Tower');
  check('Task.assignedTo populates to Employee', (populatedTask?.assignedTo as { name?: string } | null)?.name === 'Kumar Worker');

  const populatedMaterial = await MaterialModel.findById(material._id).populate('vendor');
  check('Material.vendor populates', (populatedMaterial?.vendor as { name?: string } | null)?.name === 'BuildMart Supplies');

  // Cleanup
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  console.log(`\n${'='.repeat(40)}`);
  console.log(`Phase 2 model test: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(40));

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('\nTest run crashed:', err);
  process.exit(1);
});
