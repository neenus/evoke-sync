import { Router } from 'express';
import appAuthRoutes from './appAuth.routes';
import qboAuthRoutes from './qboAuth.routes';

const router = Router();

router.use('/auth/app', appAuthRoutes);
router.use('/auth/qbo', qboAuthRoutes);

// Additional routes will be registered here as each step is completed:
// router.use('/qbo', qboRoutes);
// router.use('/reconciliation', reconciliationRoutes);
// router.use('/practitioners', practitionersRoutes);

export default router;
