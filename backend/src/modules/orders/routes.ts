import { Router } from 'express';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { listOrdersSchema, createOrderSchema, orderIdSchema } from './schema';
import {
  getOrdersHandler,
  createOrderHandler,
  reserveOrderHandler,
  cancelOrderHandler,
} from './controller';

const router = Router();

router.get('/', validate(listOrdersSchema), getOrdersHandler);

// Admin and Sales can create orders
router.post('/', requireRole('ADMIN', 'SALES'), validate(createOrderSchema), createOrderHandler);

// The core reservation concurrency path
router.post(
  '/:id/reserve',
  requireRole('ADMIN', 'SALES'),
  validate(orderIdSchema),
  reserveOrderHandler,
);

// Cancel and release reservations
router.post(
  '/:id/cancel',
  requireRole('ADMIN', 'SALES'),
  validate(orderIdSchema),
  cancelOrderHandler,
);

export default router;
