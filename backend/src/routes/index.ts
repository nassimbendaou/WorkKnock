import { Router } from 'express';
import authRoutes from './auth.routes';
import clientRoutes from './clients.routes';
import contractRoutes from './contracts.routes';
import invoiceRoutes from './invoices.routes';
import expenseRoutes from './expenses.routes';
import payslipRoutes from './payslips.routes';
import leaveRoutes from './leaves.routes';
import revenueRoutes from './revenue.routes';
import integrationRoutes from './integrations.routes';
import webhookRoutes from './webhooks.routes';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use('/auth', authRoutes);
router.use('/webhooks', webhookRoutes);

// Protected routes
router.use('/clients', authenticate, clientRoutes);
router.use('/contracts', authenticate, contractRoutes);
router.use('/invoices', authenticate, invoiceRoutes);
router.use('/expenses', authenticate, expenseRoutes);
router.use('/payslips', authenticate, payslipRoutes);
router.use('/leaves', authenticate, leaveRoutes);
router.use('/revenue', authenticate, revenueRoutes);
router.use('/integrations', authenticate, integrationRoutes);

export default router;
