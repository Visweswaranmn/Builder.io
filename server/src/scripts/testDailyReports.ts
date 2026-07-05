/**
 * Phase 10 smoke test — drives the real Express app's /daily-reports CRUD +
 * media upload + issues sub-resource over HTTP, including genuine multipart
 * file uploads (Node's native FormData/Blob) exercised against the local-disk
 * upload fallback (no Cloudinary credentials in this test environment).
 * Run with:
 *   npm run test:dailyreports --workspace server
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
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
  data?: Record<string, any>;
}

async function json(res: Response): Promise<JsonBody> {
  return (await res.json()) as JsonBody;
}

function fakeImage(): Blob {
  return new Blob([Buffer.from('not-a-real-image-but-fine-for-a-mimetype-check')], { type: 'image/jpeg' });
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
  const reportsBase = `http://127.0.0.1:${port}/api/v1/daily-reports`;

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
  // A second site_engineer to verify ownership isolation between two engineers.
  const secondEngineer = await UserModel.create({
    name: 'Second Engineer', email: 'engineer2@cpms.test', password: rolePassword, role: 'site_engineer',
  });
  const secondEngineerLoginRes = await fetch(`${authBase}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: secondEngineer.email, password: rolePassword }),
  });
  const secondEngineerLoginBody = await json(secondEngineerLoginRes);
  const secondEngineerToken = secondEngineerLoginBody.data?.accessToken as string;

  check('All 4 role users + a second engineer logged in', Object.values(roleUsers).every((u) => typeof u.token === 'string') && typeof secondEngineerToken === 'string');

  const project = await ProjectModel.create({
    name: 'Skyline Tower', client: 'Acme', budget: 1_000_000, startDate: new Date(),
  });

  const authHeader = (role: UserRole) => ({ Authorization: `Bearer ${roleUsers[role].token}` });

  // 1. Create — RBAC + multipart with real file uploads
  console.log('\nCreate daily report (RBAC + media upload)');
  const noAuthForm = new FormData();
  noAuthForm.append('project', project._id.toString());
  const noAuthRes = await fetch(reportsBase, { method: 'POST', body: noAuthForm });
  check('Create without auth returns 401', noAuthRes.status === 401);

  const accountantForm = new FormData();
  accountantForm.append('project', project._id.toString());
  const accountantRes = await fetch(reportsBase, {
    method: 'POST',
    headers: authHeader('accountant'),
    body: accountantForm,
  });
  check('Create as accountant returns 403 (not a site-reporting role)', accountantRes.status === 403);

  const createForm = new FormData();
  createForm.append('project', project._id.toString());
  createForm.append('workDone', 'Poured foundation for Block A');
  createForm.append('progressPercentage', '40');
  createForm.append('laborCount', '12');
  createForm.append('weather', 'Sunny');
  createForm.append('images', fakeImage(), 'site1.jpg');
  createForm.append('images', fakeImage(), 'site2.jpg');
  createForm.append('videos', new Blob([Buffer.from('fake-video-bytes')], { type: 'video/mp4' }), 'walkthrough.mp4');

  const createRes = await fetch(reportsBase, {
    method: 'POST',
    headers: authHeader('site_engineer'),
    body: createForm,
  });
  const createBody = await json(createRes);
  check('Create as site_engineer returns 201', createRes.status === 201);
  check('Report records workDone/progress/weather correctly', createBody.data?.report?.workDone === 'Poured foundation for Block A' && createBody.data?.report?.progressPercentage === 40);
  check('Report has 2 uploaded images', createBody.data?.report?.images?.length === 2);
  check('Report has 1 uploaded video', createBody.data?.report?.videos?.length === 1);
  check('Uploaded image URLs point at the local-disk fallback (/uploads/...)', createBody.data?.report?.images?.[0]?.startsWith('/uploads/daily-reports/'));
  check('Report engineer is populated with the creator\'s name', createBody.data?.report?.engineer?.name === 'site_engineer user');
  const reportId = createBody.data?.report?._id as string;

  // Verify the file genuinely landed on disk (not just a URL string).
  const relativeImagePath = createBody.data?.report?.images?.[0] as string;
  const absoluteImagePath = path.join(process.cwd(), relativeImagePath.replace(/^\//, ''));
  check('The uploaded image file actually exists on disk', fs.existsSync(absoluteImagePath));

  const badFileTypeForm = new FormData();
  badFileTypeForm.append('project', project._id.toString());
  badFileTypeForm.append('images', new Blob([Buffer.from('nope')], { type: 'application/pdf' }), 'not-an-image.pdf');
  const badFileTypeRes = await fetch(reportsBase, {
    method: 'POST',
    headers: authHeader('site_engineer'),
    body: badFileTypeForm,
  });
  check('Uploading a disallowed file type returns 400', badFileTypeRes.status === 400);

  const missingProjectForm = new FormData();
  const missingProjectRes = await fetch(reportsBase, {
    method: 'POST',
    headers: authHeader('site_engineer'),
    body: missingProjectForm,
  });
  check('Create with missing required project returns 400', missingProjectRes.status === 400);

  const badProjectForm = new FormData();
  badProjectForm.append('project', '507f1f77bcf86cd799439011');
  const badProjectRes = await fetch(reportsBase, {
    method: 'POST',
    headers: authHeader('site_engineer'),
    body: badProjectForm,
  });
  check('Create with a non-existent project id returns 400', badProjectRes.status === 400);

  // 2. List + filtering
  console.log('\nList daily reports');
  const listNoAuthRes = await fetch(reportsBase);
  check('List without auth returns 401', listNoAuthRes.status === 401);

  const listRes = await fetch(reportsBase, { headers: authHeader('project_manager') });
  const listBody = await json(listRes);
  check('List (any authenticated role) returns 200', listRes.status === 200);
  check('List returns the 1 created report', listBody.data?.reports?.length === 1);

  const engineerFilterRes = await fetch(`${reportsBase}?engineer=${roleUsers.site_engineer.id}`, { headers: authHeader('accountant') });
  const engineerFilterBody = await json(engineerFilterRes);
  check('Engineer filter narrows to 1 report', engineerFilterBody.data?.reports?.length === 1);

  // 3. Get by id
  console.log('\nGet daily report by id');
  const getRes = await fetch(`${reportsBase}/${reportId}`, { headers: authHeader('accountant') });
  const getBody = await json(getRes);
  check('Get existing report returns 200', getRes.status === 200);
  check('Get returns the correct report', getBody.data?.report?.weather === 'Sunny');

  const getMissingRes = await fetch(`${reportsBase}/507f1f77bcf86cd799439011`, { headers: authHeader('accountant') });
  check('Get with a well-formed but unknown id returns 404', getMissingRes.status === 404);

  const getMalformedRes = await fetch(`${reportsBase}/not-an-object-id`, { headers: authHeader('accountant') });
  check('Get with a malformed id returns 400 (CastError)', getMalformedRes.status === 400);

  // 4. Update — ownership enforcement
  console.log('\nUpdate daily report (ownership)');
  const otherEngineerUpdateRes = await fetch(`${reportsBase}/${reportId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secondEngineerToken}` },
    body: JSON.stringify({ workDone: 'Hijacked update' }),
  });
  check("A DIFFERENT engineer cannot update someone else's report (403)", otherEngineerUpdateRes.status === 403);

  const ownerUpdateRes = await fetch(`${reportsBase}/${reportId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader('site_engineer') },
    body: JSON.stringify({ progressPercentage: 55 }),
  });
  const ownerUpdateBody = await json(ownerUpdateRes);
  check('The OWNING engineer can update their own report (200)', ownerUpdateRes.status === 200);
  check('Update applies the new progress', ownerUpdateBody.data?.report?.progressPercentage === 55);

  const managerUpdateRes = await fetch(`${reportsBase}/${reportId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify({ weather: 'Overcast' }),
  });
  check('A project_manager can update ANY report, not just their own (200)', managerUpdateRes.status === 200);

  // 5. Add media to an existing report — ownership enforcement
  console.log('\nAdd media (ownership)');
  const otherEngineerMediaForm = new FormData();
  otherEngineerMediaForm.append('images', fakeImage(), 'intruder.jpg');
  const otherEngineerMediaRes = await fetch(`${reportsBase}/${reportId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secondEngineerToken}` },
    body: otherEngineerMediaForm,
  });
  check("A DIFFERENT engineer cannot add media to someone else's report (403)", otherEngineerMediaRes.status === 403);

  const addMediaForm = new FormData();
  addMediaForm.append('videos', new Blob([Buffer.from('another-fake-video')], { type: 'video/quicktime' }), 'clip.mov');
  const addMediaRes = await fetch(`${reportsBase}/${reportId}/media`, {
    method: 'POST',
    headers: authHeader('site_engineer'),
    body: addMediaForm,
  });
  const addMediaBody = await json(addMediaRes);
  check('The owning engineer can add more media (201)', addMediaRes.status === 201);
  check('Report now has 2 videos total (1 original + 1 added)', addMediaBody.data?.report?.videos?.length === 2);

  const noFilesMediaRes = await fetch(`${reportsBase}/${reportId}/media`, {
    method: 'POST',
    headers: authHeader('site_engineer'),
    body: new FormData(),
  });
  check('Adding media with no files attached returns 400', noFilesMediaRes.status === 400);

  // 6. Issues sub-resource
  console.log('\nIssues');
  const addIssueRes = await fetch(`${reportsBase}/${reportId}/issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader('site_engineer') },
    body: JSON.stringify({ description: 'Water logging near the east gate', severity: 'high' }),
  });
  const addIssueBody = await json(addIssueRes);
  check('Adding an issue returns 201', addIssueRes.status === 201);
  check('Issue is recorded with the correct severity', addIssueBody.data?.report?.issues?.[0]?.severity === 'high');
  check('New issue defaults to unresolved', addIssueBody.data?.report?.issues?.[0]?.resolved === false);

  const emptyIssueUpdateRes = await fetch(`${reportsBase}/${reportId}/issues/0`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader('site_engineer') },
    body: JSON.stringify({}),
  });
  check('Updating an issue with neither field returns 400', emptyIssueUpdateRes.status === 400);

  const resolveIssueRes = await fetch(`${reportsBase}/${reportId}/issues/0`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader('project_manager') },
    body: JSON.stringify({ resolved: true }),
  });
  const resolveIssueBody = await json(resolveIssueRes);
  check('A manager can resolve an issue on any report (200)', resolveIssueRes.status === 200);
  check('Issue is now marked resolved', resolveIssueBody.data?.report?.issues?.[0]?.resolved === true);

  const missingIssueRes = await fetch(`${reportsBase}/${reportId}/issues/99`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader('site_engineer') },
    body: JSON.stringify({ resolved: true }),
  });
  check('Updating a non-existent issue index returns 404', missingIssueRes.status === 404);

  // 7. Delete — RBAC
  console.log('\nDelete daily report');
  const pmDeleteRes = await fetch(`${reportsBase}/${reportId}`, {
    method: 'DELETE',
    headers: authHeader('project_manager'),
  });
  check('Delete as project_manager returns 403 (super_admin only)', pmDeleteRes.status === 403);

  const adminDeleteRes = await fetch(`${reportsBase}/${reportId}`, {
    method: 'DELETE',
    headers: authHeader('super_admin'),
  });
  check('Delete as super_admin returns 200', adminDeleteRes.status === 200);

  const getAfterDeleteRes = await fetch(`${reportsBase}/${reportId}`, { headers: authHeader('super_admin') });
  check('Get after delete returns 404', getAfterDeleteRes.status === 404);

  // Cleanup: drop the test DB and remove the locally-uploaded test files.
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  const uploadsDir = path.join(process.cwd(), 'uploads', 'daily-reports', reportId);
  fs.rmSync(uploadsDir, { recursive: true, force: true });

  console.log(`\n${'='.repeat(40)}`);
  console.log(`Phase 10 daily report test: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(40));

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('\nTest run crashed:', err);
  process.exit(1);
});
