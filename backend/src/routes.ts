import { Router } from 'express';
import authRoutes from './modules/auth/routes';
import inventoryRoutes from './modules/inventory/routes';
import transferRoutes from './modules/transfers/routes';
import workOrdersRoutes from './modules/work-orders/routes';
import ordersRoutes from './modules/orders/routes';
import lookupRoutes from './modules/lookups/routes';
import { authenticate } from './middleware/authenticate';

const router = Router();

// Mount all modules
router.use('/auth', authRoutes);
router.use('/inventory', authenticate, inventoryRoutes);
router.use('/transfers', authenticate, transferRoutes);
router.use('/work-orders', authenticate, workOrdersRoutes);
router.use('/orders', authenticate, ordersRoutes);

// Reference lists (/locations, /items, /batches, /customers, /categories,
// /users) that the create forms depend on. Mounted at the root because they
// are shared across modules rather than owned by any one of them.
router.use('/', lookupRoutes);

export default router;
