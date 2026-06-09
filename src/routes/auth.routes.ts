import { Router } from 'express';
import { authController } from '../controllers/auth.controller';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authController.me);
router.put('/profile', authController.updateProfile);
router.put('/password', authController.changePassword);
router.get('/users', authController.listUsers);
router.put('/users/:userId/status', authController.toggleStatus);
router.put('/users/:userId/role', authController.assignRole);

export default router;
