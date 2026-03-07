import { Router } from 'express';
import * as ctrl from '../controllers/leaves.controller';
const router = Router();
router.get('/', ctrl.getLeaves);
router.get('/balance', ctrl.getLeaveBalance);
router.post('/', ctrl.createLeave);
router.put('/:id', ctrl.updateLeave);
router.delete('/:id', ctrl.deleteLeave);
export default router;
