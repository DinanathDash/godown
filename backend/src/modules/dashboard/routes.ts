import { Router } from 'express';
import { getSummary } from './controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();

router.use(authenticate);

router.get('/summary', getSummary);

export default router;
