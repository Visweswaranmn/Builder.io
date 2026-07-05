import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { env } from './config/env.js';
import apiRoutes from './routes/index.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

/**
 * Builds and configures the Express application (no listening here so it can be
 * imported by tests). Middleware order: security -> parsing -> logging -> routes
 * -> 404 -> global error handler.
 */
export function createApp(): Application {
  const app = express();

  app.set('trust proxy', 1);

  // Security headers. Cross-origin resource policy is relaxed so the client
  // dev server (a different origin) can render locally-stored upload
  // fallback media — Cloudinary-hosted media isn't affected either way.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // CORS — restricted to configured client origins
  app.use(
    cors({
      origin: env.clientUrls,
      credentials: true,
    }),
  );

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Request logging
  app.use(morgan(env.isProd ? 'combined' : 'dev'));

  // Serves the local-disk upload fallback (see services/upload.service.ts).
  // In production with Cloudinary configured this directory stays empty.
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

  // API routes
  app.use('/api/v1', apiRoutes);

  // Fallbacks
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
