import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

const dbStateLabels: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

/** Liveness + basic dependency status. Used by load balancers and uptime checks. */
router.get('/', (_req, res) => {
  res.json({
    success: true,
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    db: dbStateLabels[mongoose.connection.readyState] ?? 'unknown',
  });
});

export default router;
