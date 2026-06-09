import { Router } from 'express';
import { registrationController } from '../controllers/registration.controller';

const router = Router();

router.post('/individual', registrationController.createIndividual);
router.get('/mine', registrationController.getMyRegistrations);
router.post('/validate-id-card', registrationController.validateIdCard);
router.get('/race/:raceId', registrationController.listByRace);
router.get('/teams/mine', registrationController.getMyTeams);
router.post('/teams', registrationController.createTeam);
router.put('/teams/:teamId/members', registrationController.addTeamMember);
router.delete('/teams/:teamId/members', registrationController.removeTeamMember);
router.get('/teams/race/:raceId', registrationController.listTeamsByRace);
router.get('/teams/:id', registrationController.getTeamById);
router.get('/no/:no', registrationController.getByNo);
router.get('/:id', registrationController.getById);
router.put('/:id', registrationController.update);
router.delete('/:id', registrationController.cancel);
router.get('/:id/pickup-qrcode', registrationController.generatePickupQR);
router.get('/race/:raceId/group-statistics', registrationController.getGroupStatistics);

export default router;
