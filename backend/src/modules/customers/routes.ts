import { Router } from 'express';
import { z } from 'zod';
import * as customerController from './controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import {
  createCustomerSchema,
  updateCustomerSchema,
  queryCustomerSchema,
  addNoteSchema,
} from './schema';

const router = Router();

const uuidParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

router.use(authenticate);

router.get(
  '/',
  requireRole('ADMIN', 'SALES', 'ACCOUNTS'),
  validate(queryCustomerSchema),
  customerController.getCustomers,
);
router.get('/follow-ups', requireRole('ADMIN', 'SALES'), customerController.getFollowUps);
router.get(
  '/:id',
  requireRole('ADMIN', 'SALES', 'ACCOUNTS'),
  validate(uuidParamSchema),
  customerController.getCustomerById,
);
router.post(
  '/',
  requireRole('ADMIN', 'SALES'),
  validate(createCustomerSchema),
  customerController.createCustomer,
);
router.patch(
  '/:id',
  requireRole('ADMIN', 'SALES'),
  validate(uuidParamSchema.merge(updateCustomerSchema)),
  customerController.updateCustomer,
);
router.delete(
  '/:id',
  requireRole('ADMIN'),
  validate(uuidParamSchema),
  customerController.deleteCustomer,
);
router.post(
  '/:id/notes',
  requireRole('ADMIN', 'SALES'),
  validate(uuidParamSchema.merge(addNoteSchema)),
  customerController.addNote,
);

export default router;
