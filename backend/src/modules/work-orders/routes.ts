import { Router } from 'express';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import {
  listWorkOrdersSchema,
  createWorkOrderSchema,
  workOrderIdSchema,
  updateWorkOrderStatusSchema,
} from './schema';
import {
  getWorkOrdersHandler,
  createWorkOrderHandler,
  getWorkOrderByIdHandler,
  updateWorkOrderStatusHandler,
} from './controller';

const router = Router();

// Work orders are readable by anyone authenticated (handled by top-level app logic, but let's be explicit if needed)
router.get('/', validate(listWorkOrdersSchema), getWorkOrdersHandler);
router.get('/:id', validate(workOrderIdSchema), getWorkOrderByIdHandler);

// Admin only can create
router.post('/', requireRole('ADMIN'), validate(createWorkOrderSchema), createWorkOrderHandler);

// Admin and Operations can update status
router.patch('/:id/status', requireRole('ADMIN', 'OPERATIONS'), validate(updateWorkOrderStatusSchema), updateWorkOrderStatusHandler);

export default router;
