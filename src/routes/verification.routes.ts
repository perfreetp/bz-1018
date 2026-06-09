import { Router } from 'express';
import { verificationController } from '../controllers/verification.controller';

const router = Router();

router.post('/pickup', verificationController.verifyPickup);
router.post('/entry', verificationController.verifyEntry);
router.delete('/pickup/:verificationId/revert', verificationController.revertPickup);
router.get('/logs', verificationController.logs);
router.get('/statistics/:raceId', verificationController.statistics);
router.get('/quick-search/:raceId', verificationController.quickSearch);

export default router;
