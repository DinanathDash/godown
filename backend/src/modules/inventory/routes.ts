import { Router } from 'express';
import { getInventory, adjustStock } from './controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { getInventoryQuerySchema, adjustStockSchema } from './schema';

import { z } from 'zod';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requireRole('ADMIN', 'OPERATIONS', 'SALES'),
  validate(z.object({ query: getInventoryQuerySchema })),
  getInventory
);

router.post(
  '/adjust',
  requireRole('ADMIN', 'OPERATIONS'),
  validate(z.object({ body: adjustStockSchema })),
  adjustStock
);

export default router;
