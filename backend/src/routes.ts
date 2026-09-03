import { Router } from 'express';
import authRoutes from './modules/auth/routes';
import inventoryRoutes from './modules/inventory/routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/inventory', inventoryRoutes);

export default router;
