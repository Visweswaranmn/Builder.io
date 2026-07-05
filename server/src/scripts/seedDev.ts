/**
 * Populates the LOCAL DEV database (not the test DB) with a small set of
 * realistic sample data, so the Dashboard (and other pages) have something
 * to show when you log in during development. Idempotent — safe to re-run;
 * upserts by a natural key instead of blindly inserting duplicates.
 *
 * Run with:
 *   npm run seed:dev --workspace server
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { UserModel } from '../models/user.model.js';
import { ProjectModel } from '../models/project.model.js';
import { EmployeeModel } from '../models/employee.model.js';
import { TaskModel } from '../models/task.model.js';
import { VendorModel } from '../models/vendor.model.js';
import { MaterialModel } from '../models/material.model.js';
import { ExpenseModel } from '../models/expense.model.js';
import { logger } from '../utils/logger.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/cpms';
const SEED_PASSWORD = 'Passw0rd!123';

async function run(): Promise<void> {
  await mongoose.connect(MONGO_URI);
  logger.info(`Seeding dev database: ${MONGO_URI}`);

  // Plain findOneAndUpdate + $setOnInsert would bypass the User model's
  // pre('save') password-hashing hook (that hook only runs on .save()/.create()),
  // so new users are created explicitly instead of upserted directly.
  async function findOrCreateUser(
    email: string,
    data: { name: string; role: 'super_admin' | 'project_manager' | 'site_engineer' },
  ) {
    const existing = await UserModel.findOne({ email });
    if (existing) return existing;
    return UserModel.create({ ...data, email, password: SEED_PASSWORD });
  }

  await findOrCreateUser('admin@cpms.dev', { name: 'Admin User', role: 'super_admin' });
  const pm = await findOrCreateUser('pm@cpms.dev', { name: 'Priya Patel', role: 'project_manager' });
  const engineerUser = await findOrCreateUser('engineer@cpms.dev', { name: 'Ravi Kumar', role: 'site_engineer' });

  const skyline = await ProjectModel.findOneAndUpdate(
    { name: 'Skyline Tower' },
    {
      $setOnInsert: {
        name: 'Skyline Tower', client: 'Acme Developers', budget: 5_000_000,
        startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'),
        location: 'Chennai', status: 'in_progress', progress: 45, manager: pm._id,
      },
    },
    { upsert: true, new: true },
  );
  const harbor = await ProjectModel.findOneAndUpdate(
    { name: 'Harbor View Complex' },
    {
      $setOnInsert: {
        name: 'Harbor View Complex', client: 'Coastal Realty', budget: 2_500_000,
        startDate: new Date('2026-03-01'), location: 'Mumbai', status: 'planning', progress: 5, manager: pm._id,
      },
    },
    { upsert: true, new: true },
  );
  await ProjectModel.findOneAndUpdate(
    { name: 'Old Depot Renovation' },
    {
      $setOnInsert: {
        name: 'Old Depot Renovation', client: 'City Council', budget: 800_000,
        startDate: new Date('2025-06-01'), endDate: new Date('2026-01-01'),
        location: 'Pune', status: 'completed', progress: 100, manager: pm._id,
      },
    },
    { upsert: true, new: true },
  );

  const mason = await EmployeeModel.findOneAndUpdate(
    { name: 'Kumar Worker' },
    {
      $setOnInsert: {
        name: 'Kumar Worker', department: 'civil', designation: 'Mason', salary: 35000,
        project: skyline._id, manager: pm._id, user: engineerUser._id, isActive: true,
      },
    },
    { upsert: true, new: true },
  );
  await EmployeeModel.findOneAndUpdate(
    { name: 'Second Worker' },
    { $setOnInsert: { name: 'Second Worker', department: 'electrical', project: skyline._id, isActive: true } },
    { upsert: true, new: true },
  );
  await EmployeeModel.findOneAndUpdate(
    { name: 'Third Worker' },
    { $setOnInsert: { name: 'Third Worker', department: 'plumbing', project: harbor._id, isActive: true } },
    { upsert: true, new: true },
  );

  await TaskModel.findOneAndUpdate(
    { title: 'Pour foundation - Block A' },
    { $setOnInsert: { title: 'Pour foundation - Block A', project: skyline._id, assignedTo: mason._id, assignedBy: pm._id, priority: 'high', status: 'in_progress', progress: 60, deadline: new Date('2026-03-01') } },
    { upsert: true, new: true },
  );
  await TaskModel.findOneAndUpdate(
    { title: 'Electrical wiring - Block B' },
    { $setOnInsert: { title: 'Electrical wiring - Block B', project: skyline._id, assignedBy: pm._id, priority: 'medium', status: 'todo' } },
    { upsert: true, new: true },
  );
  await TaskModel.findOneAndUpdate(
    { title: 'Site survey' },
    { $setOnInsert: { title: 'Site survey', project: harbor._id, assignedBy: pm._id, priority: 'low', status: 'completed', progress: 100 } },
    { upsert: true, new: true },
  );

  const vendor = await VendorModel.findOneAndUpdate(
    { name: 'BuildMart Supplies' },
    { $setOnInsert: { name: 'BuildMart Supplies', companyName: 'BuildMart Pvt Ltd', phone: '9990001234', materialsSupplied: ['cement', 'steel'] } },
    { upsert: true, new: true },
  );

  const cementExists = await MaterialModel.exists({ name: 'OPC Cement 53 Grade' });
  if (!cementExists) {
    await MaterialModel.create({
      name: 'OPC Cement 53 Grade', category: 'cement', unit: 'bag', unitPrice: 380,
      quantityInStock: 25, lowStockThreshold: 20, vendor: vendor._id, project: skyline._id,
      transactions: [
        { type: 'in', quantity: 100 },
        { type: 'out', quantity: 60 },
        { type: 'out', quantity: 15 },
      ],
    });
  }
  const steelExists = await MaterialModel.exists({ name: 'TMT Steel Bar' });
  if (!steelExists) {
    await MaterialModel.create({
      name: 'TMT Steel Bar', category: 'steel', unit: 'ton', unitPrice: 62000,
      quantityInStock: 4, lowStockThreshold: 5, vendor: vendor._id, project: skyline._id,
      transactions: [
        { type: 'in', quantity: 20 },
        { type: 'out', quantity: 16 },
      ],
    });
  }

  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 12);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 20);
  const expenseExists = await ExpenseModel.exists({ description: 'Cement bulk purchase' });
  if (!expenseExists) {
    await ExpenseModel.create([
      { project: skyline._id, category: 'material', amount: 22800, description: 'Cement bulk purchase', vendor: vendor._id, date: thisMonth, recordedBy: pm._id },
      { project: skyline._id, category: 'labour', amount: 105000, description: 'Site crew wages', date: thisMonth, recordedBy: pm._id },
      { project: harbor._id, category: 'transport', amount: 8000, description: 'Equipment transport', date: lastMonth, recordedBy: pm._id },
    ]);
  }

  logger.info('Seed complete. Log in with any of:');
  logger.info(`  super_admin:     admin@cpms.dev / ${SEED_PASSWORD}`);
  logger.info(`  project_manager: pm@cpms.dev / ${SEED_PASSWORD}`);
  logger.info(`  site_engineer:   engineer@cpms.dev / ${SEED_PASSWORD}`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
