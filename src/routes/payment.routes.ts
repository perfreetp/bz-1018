import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';

const router = Router();

router.post('/', paymentController.create);
router.get('/mine', paymentController.myPayments);
router.get('/race/:raceId', paymentController.listByRace);
router.get('/order/:orderNo', paymentController.getByOrderNo);
router.get('/:id', paymentController.getById);
router.put('/confirm/:orderNo', paymentController.confirm);
router.put('/fail/:orderNo', paymentController.fail);
router.post('/callback/:orderNo', paymentController.callback);
router.post('/refunds', paymentController.createRefund);
router.get('/refunds/mine', paymentController.myRefunds);
router.get('/refunds', paymentController.listRefunds);
router.put('/refunds/:refundId/approve', paymentController.approveRefund);
router.put('/refunds/:refundId/reject', paymentController.rejectRefund);
router.put('/refunds/:refundId/process', paymentController.processRefund);

export default router;
