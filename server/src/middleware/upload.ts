import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError.js';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

/**
 * Accepts `images` (up to 10) and `videos` (up to 5) fields on a multipart
 * request. Uses memory storage so the buffer can go to either Cloudinary or
 * local disk (see upload.service.ts) without multer needing to know which.
 */
const dailyReportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const allowed = file.fieldname === 'images' ? ALLOWED_IMAGE_TYPES : ALLOWED_VIDEO_TYPES;
    if (!allowed.includes(file.mimetype)) {
      cb(new Error(`Unsupported file type for "${file.fieldname}": ${file.mimetype}`));
      return;
    }
    cb(null, true);
  },
}).fields([
  { name: 'images', maxCount: 10 },
  { name: 'videos', maxCount: 5 },
]);

/** Wraps multer so its errors (bad type, oversized file) surface as a normal ApiError 400. */
export function handleDailyReportUpload(req: Request, res: Response, next: NextFunction): void {
  dailyReportUpload(req, res, (err: unknown) => {
    if (!err) return next();
    const message = err instanceof Error ? err.message : 'File upload failed';
    next(ApiError.badRequest(message));
  });
}
