import { FilterQuery } from 'mongoose';
import {
  DailyReportModel,
  type DailyReport,
  type DailyReportDocument,
} from '../models/dailyReport.model.js';
import { ProjectModel } from '../models/project.model.js';
import { ApiError } from '../utils/ApiError.js';
import { parsePagination, buildPaginationMeta, type PaginationMeta } from '../utils/pagination.js';
import { uploadMedia } from './upload.service.js';

interface ListDailyReportsInput {
  page?: number;
  limit?: number;
  project?: string;
  engineer?: string;
  from?: Date;
  to?: Date;
}

interface UploadedFiles {
  images?: Express.Multer.File[];
  videos?: Express.Multer.File[];
}

interface CurrentUser {
  id: string;
  role: string;
}

const POPULATE_FIELDS = [
  { path: 'project', select: 'name status' },
  { path: 'engineer', select: 'name email role' },
];

async function assertProjectExists(projectId: string | undefined): Promise<void> {
  if (!projectId) return;
  const exists = await ProjectModel.exists({ _id: projectId });
  if (!exists) throw ApiError.badRequest('project does not reference an existing project');
}

/** Site engineers may only touch their own filed reports; managers/admins may touch any. */
function assertOwnerOrManager(report: DailyReportDocument, user: CurrentUser): void {
  const isManager = user.role === 'super_admin' || user.role === 'project_manager';
  if (!isManager && report.engineer.toString() !== user.id) {
    throw ApiError.forbidden('You can only modify your own daily reports');
  }
}

async function uploadFiles(
  reportId: string,
  files: UploadedFiles,
): Promise<{ images: string[]; videos: string[] }> {
  const folder = `daily-reports/${reportId}`;
  const [images, videos] = await Promise.all([
    Promise.all((files.images ?? []).map((f) => uploadMedia(f.buffer, f.originalname, 'image', folder))),
    Promise.all((files.videos ?? []).map((f) => uploadMedia(f.buffer, f.originalname, 'video', folder))),
  ]);
  return { images: images.map((u) => u.url), videos: videos.map((u) => u.url) };
}

export async function listDailyReports(
  input: ListDailyReportsInput,
): Promise<{ reports: DailyReportDocument[]; meta: PaginationMeta }> {
  const pagination = parsePagination(input);

  const filter: FilterQuery<DailyReport> = {};
  if (input.project) filter.project = input.project;
  if (input.engineer) filter.engineer = input.engineer;
  if (input.from || input.to) {
    filter.date = {};
    if (input.from) filter.date.$gte = input.from;
    if (input.to) filter.date.$lte = input.to;
  }

  const [reports, total] = await Promise.all([
    DailyReportModel.find(filter)
      .populate(POPULATE_FIELDS)
      .sort({ date: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    DailyReportModel.countDocuments(filter),
  ]);

  return { reports, meta: buildPaginationMeta(pagination, total) };
}

export async function getDailyReportById(id: string): Promise<DailyReportDocument> {
  const report = await DailyReportModel.findById(id).populate(POPULATE_FIELDS);
  if (!report) throw ApiError.notFound('Daily report not found');
  return report;
}

export async function createDailyReport(
  input: Partial<DailyReport>,
  engineerId: string,
  files: UploadedFiles = {},
): Promise<DailyReportDocument> {
  await assertProjectExists(input.project?.toString());

  const report = await DailyReportModel.create({ ...input, engineer: engineerId });

  const hasFiles = (files.images?.length ?? 0) > 0 || (files.videos?.length ?? 0) > 0;
  if (hasFiles) {
    const uploaded = await uploadFiles(report._id.toString(), files);
    report.images.push(...uploaded.images);
    report.videos.push(...uploaded.videos);
    await report.save();
  }

  return report.populate(POPULATE_FIELDS);
}

export async function updateDailyReport(
  id: string,
  input: Partial<DailyReport>,
  user: CurrentUser,
): Promise<DailyReportDocument> {
  const report = await DailyReportModel.findById(id);
  if (!report) throw ApiError.notFound('Daily report not found');
  assertOwnerOrManager(report, user);

  Object.assign(report, input);
  await report.save();

  return report.populate(POPULATE_FIELDS);
}

export async function deleteDailyReport(id: string): Promise<void> {
  const report = await DailyReportModel.findByIdAndDelete(id);
  if (!report) throw ApiError.notFound('Daily report not found');
}

export async function addMedia(
  id: string,
  files: UploadedFiles,
  user: CurrentUser,
): Promise<DailyReportDocument> {
  const report = await DailyReportModel.findById(id);
  if (!report) throw ApiError.notFound('Daily report not found');
  assertOwnerOrManager(report, user);

  const hasFiles = (files.images?.length ?? 0) > 0 || (files.videos?.length ?? 0) > 0;
  if (!hasFiles) throw ApiError.badRequest('No images or videos were provided');

  const uploaded = await uploadFiles(report._id.toString(), files);
  report.images.push(...uploaded.images);
  report.videos.push(...uploaded.videos);
  await report.save();

  return report.populate(POPULATE_FIELDS);
}

export async function addIssue(
  id: string,
  input: { description: string; severity?: 'low' | 'medium' | 'high' },
  user: CurrentUser,
): Promise<DailyReportDocument> {
  const report = await DailyReportModel.findById(id);
  if (!report) throw ApiError.notFound('Daily report not found');
  assertOwnerOrManager(report, user);

  report.issues.push(input);
  await report.save();

  return report.populate(POPULATE_FIELDS);
}

export async function updateIssue(
  id: string,
  issueIndex: number,
  input: { severity?: 'low' | 'medium' | 'high'; resolved?: boolean },
  user: CurrentUser,
): Promise<DailyReportDocument> {
  const report = await DailyReportModel.findById(id);
  if (!report) throw ApiError.notFound('Daily report not found');
  assertOwnerOrManager(report, user);

  const issue = report.issues[issueIndex];
  if (!Number.isInteger(issueIndex) || !issue) throw ApiError.notFound('Issue not found on this report');

  if (input.severity !== undefined) issue.severity = input.severity;
  if (input.resolved !== undefined) issue.resolved = input.resolved;
  await report.save();

  return report.populate(POPULATE_FIELDS);
}
