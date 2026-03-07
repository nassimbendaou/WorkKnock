import { Router } from 'express';
import * as ctrl from '../controllers/clients.controller';
const router = Router();
router.get('/', ctrl.getClients);
router.get('/:id', ctrl.getClient);
router.post('/', ctrl.createClient);
router.put('/:id', ctrl.updateClient);
router.delete('/:id', ctrl.deleteClient);
export default router;
