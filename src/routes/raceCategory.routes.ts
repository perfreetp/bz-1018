import { Router } from 'express';
import { raceCategoryController } from '../controllers/raceCategory.controller';

const router = Router();

router.post('/', raceCategoryController.create);
router.get('/', raceCategoryController.list);
router.get('/race/:raceId', raceCategoryController.getByRace);
router.get('/:id', raceCategoryController.getById);
router.put('/:id', raceCategoryController.update);
router.delete('/:id', raceCategoryController.delete);
router.put('/:id/activate', raceCategoryController.activate);
router.put('/:id/deactivate', raceCategoryController.deactivate);
router.get('/:id/capacity', raceCategoryController.checkCapacity);
router.get('/:id/price', raceCategoryController.getPrice);

export default router;
