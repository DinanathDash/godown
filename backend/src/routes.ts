import { Router } from 'express';
import authRoutes from './modules/auth/routes';
import inventoryRoutes from './modules/inventory/routes';
import transferRoutes from './modules/transfers/routes';

const router = Router();

// Mount all modules
router.use('/auth', authRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/transfers', transferRoutes);

export default router;
