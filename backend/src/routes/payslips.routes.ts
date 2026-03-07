import { Router } from 'express';
import * as ctrl from '../controllers/payslips.controller';
const router = Router();
router.get('/', ctrl.getPaySlips);
router.get('/:id', ctrl.getPaySlip);
router.post('/', ctrl.generatePaySlip);
router.put('/:id', ctrl.updatePaySlip);
router.get('/:id/download', ctrl.downloadPaySlip);
export default router;
