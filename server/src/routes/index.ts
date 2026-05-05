import { Router } from 'express';
import appAuthRoutes from './appAuth.routes';

const router = Router();

router.use('/auth/app', appAuthRoutes);

// Additional routes will be registered here as each step is completed:
// router.use('/auth/qbo', qboAuthRoutes);
// router.use('/qbo', qboRoutes);
// router.use('/reconciliation', reconciliationRoutes);
// router.use('/practitioners', practitionersRoutes);

export default router;
