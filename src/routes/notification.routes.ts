import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';

const router = Router();

router.post('/', notificationController.send);
router.get('/', notificationController.list);
router.get('/mine', notificationController.myNotifications);
router.get('/unread-count', notificationController.unreadCount);
router.put('/:id/read', notificationController.markRead);
router.put('/:id/retry', notificationController.retry);
router.post('/batch/send-by-race', notificationController.batchSendByRace);

export default router;
