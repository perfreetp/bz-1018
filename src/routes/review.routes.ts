import { Router } from 'express';
import { reviewController } from '../controllers/review.controller';

const router = Router();

router.put('/:id/approve', reviewController.approve);
router.put('/:id/reject', reviewController.reject);
router.put('/:id/require-supplement', reviewController.requireSupplement);
router.put('/:id/lock', reviewController.lock);
router.put('/:id/unlock', reviewController.unlock);
router.put('/:id/assign-bib', reviewController.assignBib);
router.post('/batch/assign-bib', reviewController.batchAssignBib);
router.post('/batch/approve', reviewController.batchApprove);
router.post('/batch/reject', reviewController.batchReject);
router.get('/pending/:raceId', reviewController.pendingList);
router.put('/teams/:teamId/approve', reviewController.approveTeam);
router.put('/teams/:teamId/reject', reviewController.rejectTeam);

export default router;
