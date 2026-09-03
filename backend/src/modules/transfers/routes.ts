import { Router } from 'express';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { listTransfersSchema, createTransferSchema, transferIdSchema } from './schema';
import {
  getTransfersHandler,
  createTransferHandler,
  dispatchTransferHandler,
  receiveTransferHandler,
  cancelTransferHandler,
} from './controller';

const router = Router();

// All transfer routes require ADMIN or OPERATIONS role
router.use(requireRole('ADMIN', 'OPERATIONS'));

router.get('/', validate(listTransfersSchema), getTransfersHandler);
router.post('/', validate(createTransferSchema), createTransferHandler);

router.post('/:id/dispatch', validate(transferIdSchema), dispatchTransferHandler);
router.post('/:id/receive', validate(transferIdSchema), receiveTransferHandler);
router.post('/:id/cancel', validate(transferIdSchema), cancelTransferHandler);

export default router;
