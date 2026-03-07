import { Router } from 'express';
import * as ctrl from '../controllers/revenue.controller';
const router = Router();
router.get('/dashboard', ctrl.getDashboard);
router.get('/stats', ctrl.getRevenueStats);
export default router;
