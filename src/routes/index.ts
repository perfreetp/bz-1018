import { Router } from 'express';
import { Request, Response } from 'express';
import authRoutes from './auth.routes';
import raceRoutes from './race.routes';
import categoryRoutes from './raceCategory.routes';
import registrationRoutes from './registration.routes';
import reviewRoutes from './review.routes';
import paymentRoutes from './payment.routes';
import notificationRoutes from './notification.routes';
import verificationRoutes from './verification.routes';
import { successResponse } from '../utils/response';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  successResponse(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    service: 'Marathon Registration Backend',
  });
});

router.use('/auth', authRoutes);
router.use('/races', raceRoutes);
router.use('/categories', categoryRoutes);
router.use('/registrations', registrationRoutes);
router.use('/reviews', reviewRoutes);
router.use('/payments', paymentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/verifications', verificationRoutes);

export default router;
