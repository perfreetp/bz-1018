import { Router } from 'express';
import { raceController } from '../controllers/race.controller';

const router = Router();

router.post('/', raceController.create);
router.get('/', raceController.list);
router.get('/published', raceController.listPublished);
router.get('/:id', raceController.getById);
router.get('/code/:code', raceController.getByCode);
router.put('/:id', raceController.update);
router.delete('/:id', raceController.delete);
router.put('/:id/publish', raceController.publish);
router.put('/:id/open-registration', raceController.openRegistration);
router.put('/:id/close-registration', raceController.closeRegistration);
router.put('/:id/complete', raceController.complete);
router.put('/:id/cancel', raceController.cancel);
router.get('/:id/statistics', raceController.getStatistics);

export default router;
