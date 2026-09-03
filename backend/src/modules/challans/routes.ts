import { Router } from 'express';
import { z } from 'zod';
import * as challanController from './controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import { createChallanSchema, updateChallanSchema, queryChallanSchema } from './schema';

const router = Router();

const uuidParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

router.use(authenticate);

// Read-only routes allowed for all roles (Challans: read)
router.get(
  '/',
  requireRole('ADMIN', 'WAREHOUSE', 'SALES', 'ACCOUNTS'),
  validate(queryChallanSchema),
  challanController.getChallans,
);
router.get(
  '/:id',
  requireRole('ADMIN', 'WAREHOUSE', 'SALES', 'ACCOUNTS'),
  validate(uuidParamSchema),
  challanController.getChallanById,
);

// Write routes restricted to ADMIN and SALES (Challans: create / edit draft)
router.post(
  '/',
  requireRole('ADMIN', 'SALES'),
  validate(createChallanSchema),
  challanController.createChallan,
);
router.patch(
  '/:id',
  requireRole('ADMIN', 'SALES'),
  validate(uuidParamSchema.merge(updateChallanSchema)),
  challanController.updateChallan,
);

// Confirm allowed for ADMIN, SALES, WAREHOUSE
router.post(
  '/:id/confirm',
  requireRole('ADMIN', 'SALES', 'WAREHOUSE'),
  validate(uuidParamSchema),
  challanController.confirmChallan,
);

// Cancel allowed for ADMIN only
router.post(
  '/:id/cancel',
  requireRole('ADMIN'),
  validate(uuidParamSchema),
  challanController.cancelChallan,
);

export default router;
