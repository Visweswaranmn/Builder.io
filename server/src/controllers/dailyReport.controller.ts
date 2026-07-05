import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import * as dailyReportService from '../services/dailyReport.service.js';

function requireUser(req: Request): { id: string; role: string } {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  return req.user;
}

function extractFiles(req: Request): { images?: Express.Multer.File[]; videos?: Express.Multer.File[] } {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  return { images: files?.images, videos: files?.videos };
}

export const listDailyReports = asyncHandler(async (req: Request, res: Response) => {
  const { reports, meta } = await dailyReportService.listDailyReports(req.validatedQuery ?? {});
  res.json({ success: true, data: { reports, meta } });
});

export const getDailyReport = asyncHandler(async (req: Request, res: Response) => {
  const report = await dailyReportService.getDailyReportById(req.params.id);
  res.json({ success: true, data: { report } });
});

export const createDailyReport = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const report = await dailyReportService.createDailyReport(req.body, user.id, extractFiles(req));
  res.status(201).json({ success: true, message: 'Daily report submitted', data: { report } });
});

export const updateDailyReport = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const report = await dailyReportService.updateDailyReport(req.params.id, req.body, user);
  res.json({ success: true, message: 'Daily report updated', data: { report } });
});

export const deleteDailyReport = asyncHandler(async (req: Request, res: Response) => {
  await dailyReportService.deleteDailyReport(req.params.id);
  res.json({ success: true, message: 'Daily report deleted' });
});

export const addMedia = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const report = await dailyReportService.addMedia(req.params.id, extractFiles(req), user);
  res.status(201).json({ success: true, message: 'Media uploaded', data: { report } });
});

export const addIssue = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const report = await dailyReportService.addIssue(req.params.id, req.body, user);
  res.status(201).json({ success: true, message: 'Issue logged', data: { report } });
});

export const updateIssue = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const report = await dailyReportService.updateIssue(
    req.params.id,
    Number(req.params.issueIndex),
    req.body,
    user,
  );
  res.json({ success: true, message: 'Issue updated', data: { report } });
});
