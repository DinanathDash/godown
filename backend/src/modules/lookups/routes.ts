import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';
import * as controller from './controller';

const router = Router();

router.use(authenticate);

// Reference data every role needs to fill in a form.
router.get('/locations', controller.listLocations);
router.get('/categories', controller.listCategories);
router.get('/items', controller.listItems);
router.get('/batches', controller.listBatches);
router.get('/customers', controller.listCustomers);

// Assignee picker on work orders. Restricted because it lists people, and only
// the roles that can raise or run a work order need it.
router.get('/users', requireRole('ADMIN', 'OPERATIONS'), controller.listUsers);

export default router;
