import { Request, Response, NextFunction } from 'express';
import { body, param, query } from 'express-validator';
import { registrationService } from '../services/registration.service';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { successResponse, paginatedResponse, errorResponse } from '../utils/response';
import { Role, ReviewStatus, PaymentStatus, RegistrationType, Gender, IDType, ClothingSize } from '../types/enums';
import { AuthRequest } from '../types';
import { validateIdCard } from '../utils/validators';

export const registrationValidation = {
  create: [
    body('raceId').isMongoId().withMessage('赛事ID格式不正确'),
    body('categoryId').isMongoId().withMessage('组别ID格式不正确'),
    body('realName').notEmpty().withMessage('真实姓名不能为空'),
    body('gender').isIn(Object.values(Gender)).withMessage('性别不正确'),
    body('birthDate').isISO8601().withMessage('出生日期格式不正确'),
    body('idDocument').isObject().withMessage('证件信息不能为空'),
    body('idDocument.type').isIn(Object.values(IDType)).withMessage('证件类型不正确'),
    body('idDocument.number').notEmpty().withMessage('证件号码不能为空'),
    body('phone').matches(/^1[3-9]\d{9}$/).withMessage('手机号格式不正确'),
    body('email').optional().isEmail().withMessage('邮箱格式不正确'),
    body('emergencyContact').isObject().withMessage('紧急联系人信息不能为空'),
    body('emergencyContact.name').notEmpty().withMessage('紧急联系人姓名不能为空'),
    body('emergencyContact.relationship').notEmpty().withMessage('与紧急联系人关系不能为空'),
    body('emergencyContact.phone').matches(/^1[3-9]\d{9}$/).withMessage('紧急联系人手机号格式不正确'),
    body('clothingSize').isIn(Object.values(ClothingSize)).withMessage('衣服尺码不正确'),
    body('waiverSigned').isBoolean().withMessage('请签署免责声明'),
    validateRequest,
  ],
  update: [
    param('id').isMongoId().withMessage('报名ID格式不正确'),
    validateRequest,
  ],
  idParam: [param('id').isMongoId().withMessage('ID格式不正确'), validateRequest],
  teamCreate: [
    body('userId').isMongoId().withMessage('用户ID格式不正确'),
    body('raceId').isMongoId().withMessage('赛事ID格式不正确'),
    body('categoryId').isMongoId().withMessage('组别ID格式不正确'),
    body('name').notEmpty().withMessage('团队名称不能为空'),
    body('captainRegistrationId').isMongoId().withMessage('队长报名ID格式不正确'),
    validateRequest,
  ],
};

export const registrationController = {
  createIndividual: [
    optionalAuthMiddleware,
    ...registrationValidation.create,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.userId;
        const data = {
          ...req.body,
          userId,
          registeredBy: userId,
        };
        const registration = await registrationService.createIndividualRegistration(data);
        successResponse(res, registration, '报名成功', 201);
      } catch (error) {
        next(error);
      }
    },
  ],

  getById: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER, Role.VOLUNTEER, Role.CHECKER, Role.USER]),
    ...registrationValidation.idParam,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const registration = await registrationService.getRegistrationById(req.params.id);
        if (!registration) {
          errorResponse(res, '报名记录不存在', 404);
          return;
        }
        if (req.user!.role === Role.USER && registration.userId && registration.userId?.toString() !== req.user!.userId) {
          errorResponse(res, '无权查看此报名记录', 403);
          return;
        }
        successResponse(res, registration);
      } catch (error) {
        next(error);
      }
    },
  ],

  getByNo: [
    param('no').notEmpty().withMessage('报名编号不能为空'),
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const registration = await registrationService.getRegistrationByNo(req.params.no);
        if (!registration) {
          errorResponse(res, '报名记录不存在', 404);
          return;
        }
        successResponse(res, registration);
      } catch (error) {
        next(error);
      }
    },
  ],

  getMyRegistrations: [
    authMiddleware([Role.USER]),
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 100 }),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const result = await registrationService.getUserRegistrations(req.user!.userId, {
          page: parseInt(req.query.page as string) || 1,
          pageSize: parseInt(req.query.pageSize as string) || 20,
        });
        paginatedResponse(res, result);
      } catch (error) {
        next(error);
      }
    },
  ],

  listByRace: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER, Role.VOLUNTEER]),
    param('raceId').isMongoId().withMessage('赛事ID格式不正确'),
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 500 }),
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await registrationService.getRaceRegistrations(req.params.raceId, {
          page: parseInt(req.query.page as string) || 1,
          pageSize: parseInt(req.query.pageSize as string) || 50,
          categoryId: req.query.categoryId as string,
          reviewStatus: req.query.reviewStatus as ReviewStatus,
          paymentStatus: req.query.paymentStatus as PaymentStatus,
          registrationType: req.query.registrationType as RegistrationType,
          isLocked: req.query.isLocked === 'true' ? true : req.query.isLocked === 'false' ? false : undefined,
          isPickupVerified: req.query.isPickupVerified === 'true' ? true : req.query.isPickupVerified === 'false' ? false : undefined,
          isCancelled: req.query.isCancelled === 'true' ? true : req.query.isCancelled === 'false' ? false : undefined,
          keyword: req.query.keyword as string,
          bibNumber: req.query.bibNumber as string,
          phone: req.query.phone as string,
          idNumber: req.query.idNumber as string,
          sortBy: req.query.sortBy as string,
          sortOrder: req.query.sortOrder as 'asc' | 'desc',
        });
        paginatedResponse(res, result);
      } catch (error) {
        next(error);
      }
    },
  ],

  update: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER, Role.VOLUNTEER, Role.USER]),
    ...registrationValidation.update,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const registration = await registrationService.getRegistrationById(req.params.id);
        if (!registration) {
          errorResponse(res, '报名记录不存在', 404);
          return;
        }
        if (req.user!.role === Role.USER && registration.userId && registration.userId?.toString() !== req.user!.userId) {
          errorResponse(res, '无权修改此报名记录', 403);
          return;
        }
        const updated = await registrationService.updateRegistration(req.params.id, req.body);
        if (!updated) {
          errorResponse(res, '报名记录不存在', 404);
          return;
        }
        successResponse(res, updated, '更新报名资料成功');
      } catch (error) {
        next(error);
      }
    },
  ],

  cancel: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER, Role.USER]),
    ...registrationValidation.idParam,
    body('reason').notEmpty().withMessage('取消原因不能为空'),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const registration = await registrationService.getRegistrationById(req.params.id);
        if (!registration) {
          errorResponse(res, '报名记录不存在', 404);
          return;
        }
        if (req.user!.role === Role.USER && registration.userId && registration.userId?.toString() !== req.user!.userId) {
          errorResponse(res, '无权取消此报名', 403);
          return;
        }
        const adminId = [Role.ADMIN, Role.ORGANIZER].includes(req.user!.role) ? req.user!.userId : undefined;
        await registrationService.cancelRegistration(req.params.id, req.body.reason, adminId);
        successResponse(res, null, '取消报名成功');
      } catch (error) {
        next(error);
      }
    },
  ],

  generatePickupQR: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER, Role.USER]),
    ...registrationValidation.idParam,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const registration = await registrationService.getRegistrationById(req.params.id);
        if (!registration) {
          errorResponse(res, '报名记录不存在', 404);
          return;
        }
        if (req.user!.role === Role.USER && registration.userId && registration.userId?.toString() !== req.user!.userId) {
          errorResponse(res, '无权获取此二维码', 403);
          return;
        }
        const result = await registrationService.generatePickupQRCode(req.params.id);
        successResponse(res, result);
      } catch (error) {
        next(error);
      }
    },
  ],

  validateIdCard: [
    body('idNumber').notEmpty().withMessage('身份证号不能为空'),
    validateRequest,
    (req: Request, res: Response) => {
      const result = validateIdCard(req.body.idNumber);
      successResponse(res, result, result.valid ? '身份证号有效' : '身份证号无效');
    },
  ],

  createTeam: [
    authMiddleware([Role.USER]),
    ...registrationValidation.teamCreate,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        if (req.body.userId !== req.user!.userId) {
          errorResponse(res, '只能用自己的账号创建团队', 403);
          return;
        }
        const team = await registrationService.createTeam(req.body);
        successResponse(res, team, '创建团队成功', 201);
      } catch (error) {
        next(error);
      }
    },
  ],

  addTeamMember: [
    authMiddleware([Role.USER]),
    param('teamId').isMongoId().withMessage('团队ID格式不正确'),
    body('registrationId').isMongoId().withMessage('报名ID格式不正确'),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const team = await registrationService.addTeamMember(
          req.params.teamId,
          req.body.registrationId,
          req.user!.userId
        );
        successResponse(res, team, '加入团队成功');
      } catch (error) {
        next(error);
      }
    },
  ],

  removeTeamMember: [
    authMiddleware([Role.USER, Role.ADMIN, Role.ORGANIZER]),
    param('teamId').isMongoId().withMessage('团队ID格式不正确'),
    body('registrationId').isMongoId().withMessage('报名ID格式不正确'),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const team = await registrationService.removeTeamMember(
          req.params.teamId,
          req.body.registrationId,
          req.user!.role === Role.USER ? req.user!.userId : (await registrationService.getTeamById(req.params.teamId))?.captainId.toString() || ''
        );
        successResponse(res, team, '移除成员成功');
      } catch (error) {
        next(error);
      }
    },
  ],

  getTeamById: [
    param('id').isMongoId().withMessage('团队ID格式不正确'),
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const team = await registrationService.getTeamById(req.params.id);
        if (!team) {
          errorResponse(res, '团队不存在', 404);
          return;
        }
        successResponse(res, team);
      } catch (error) {
        next(error);
      }
    },
  ],

  getMyTeams: [
    authMiddleware([Role.USER]),
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const teams = await registrationService.getUserTeams(req.user!.userId);
        successResponse(res, teams);
      } catch (error) {
        next(error);
      }
    },
  ],

  listTeamsByRace: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER, Role.VOLUNTEER]),
    param('raceId').isMongoId().withMessage('赛事ID格式不正确'),
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 200 }),
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await registrationService.getRaceTeams(req.params.raceId, {
          page: parseInt(req.query.page as string) || 1,
          pageSize: parseInt(req.query.pageSize as string) || 50,
          reviewStatus: req.query.reviewStatus as ReviewStatus,
          paymentStatus: req.query.paymentStatus as PaymentStatus,
          keyword: req.query.keyword as string,
        });
        paginatedResponse(res, result);
      } catch (error) {
        next(error);
      }
    },
  ],

  getGroupStatistics: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    param('raceId').isMongoId().withMessage('赛事ID格式不正确'),
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const stats = await registrationService.getGroupStatistics(req.params.raceId);
        successResponse(res, stats);
      } catch (error) {
        next(error);
      }
    },
  ],
};
