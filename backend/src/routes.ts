import { Router } from 'express';
import authRoutes from './modules/auth/routes';
import inventoryRoutes from './modules/inventory/routes';
import transferRoutes from './modules/transfers/routes';
import workOrdersRoutes from './modules/work-orders/routes';
import ordersRoutes from './modules/orders/routes';
import { authenticate } from './middleware/authenticate';

const router = Router();

// Mount all modules
router.use('/auth', authRoutes);
router.use('/inventory', authenticate, inventoryRoutes);
router.use('/transfers', authenticate, transferRoutes);
router.use('/work-orders', authenticate, workOrdersRoutes);
router.use('/orders', authenticate, ordersRoutes);

export default router;
