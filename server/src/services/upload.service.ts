import { v2 as cloudinary } from 'cloudinary';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

const isCloudinaryConfigured = Boolean(
  env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret,
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
  });
  logger.info('Cloudinary configured — media uploads will be stored in the cloud.');
} else {
  logger.warn('Cloudinary is not configured — media uploads fall back to local disk (dev only).');
}

export interface UploadResult {
  url: string;
  publicId?: string;
}

function uploadToCloudinary(
  buffer: Buffer,
  folder: string,
  resourceType: 'image' | 'video',
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (err, result) => {
        if (err || !result) {
          reject(err ?? new Error('Cloudinary upload failed'));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(buffer);
  });
}

async function uploadToLocalDisk(buffer: Buffer, originalName: string, folder: string): Promise<UploadResult> {
  const dir = path.join(UPLOAD_DIR, folder);
  await fs.mkdir(dir, { recursive: true });
  const ext = path.extname(originalName);
  const filename = `${crypto.randomUUID()}${ext}`;
  await fs.writeFile(path.join(dir, filename), buffer);
  return { url: `/uploads/${folder}/${filename}` };
}

/**
 * Uploads a file buffer to Cloudinary if configured, otherwise to local disk
 * under `server/uploads/<folder>/` (served statically — see app.ts). This
 * lets media upload be fully exercised in dev/test without cloud credentials,
 * while switching transparently to Cloudinary once `CLOUDINARY_*` env vars
 * are set — no calling code needs to change.
 */
export async function uploadMedia(
  buffer: Buffer,
  originalName: string,
  resourceType: 'image' | 'video',
  folder: string,
): Promise<UploadResult> {
  if (isCloudinaryConfigured) {
    return uploadToCloudinary(buffer, folder, resourceType);
  }
  return uploadToLocalDisk(buffer, originalName, folder);
}
