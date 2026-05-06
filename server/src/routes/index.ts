import { Router } from 'express';
import appAuthRoutes from './appAuth.routes';
import qboAuthRoutes from './qboAuth.routes';
import qboRoutes from './qbo.routes';
import reconciliationRoutes from './reconciliation.routes';
import practitionersRoutes from './practitioners.routes';

const router = Router();

router.use('/auth/app', appAuthRoutes);
router.use('/auth/qbo', qboAuthRoutes);
router.use('/qbo', qboRoutes);
router.use('/reconciliation', reconciliationRoutes);
router.use('/practitioners', practitionersRoutes);

export default router;
