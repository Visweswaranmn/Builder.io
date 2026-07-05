import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Read-only rollup — every authenticated role may view it.
router.get('/summary', authenticate, dashboardController.getSummary);

export default router;
