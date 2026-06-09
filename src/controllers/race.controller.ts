import { Request, Response, NextFunction } from 'express';
import { body, param, query } from 'express-validator';
import { raceService } from '../services/race.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { successResponse, paginatedResponse, errorResponse } from '../utils/response';
import { Role, RaceStatus } from '../types/enums';
import { AuthRequest } from '../types';

export const raceValidation = {
  create: [
    body('name').notEmpty().withMessage('赛事名称不能为空'),
    body('code').notEmpty().withMessage('赛事代码不能为空').isUppercase(),
    body('edition').notEmpty().withMessage('届次不能为空'),
    body('raceDate').isISO8601().withMessage('比赛日期格式不正确'),
    body('registrationStartTime').isISO8601().withMessage('报名开始时间格式不正确'),
    body('registrationEndTime').isISO8601().withMessage('报名结束时间格式不正确'),
    body('paymentDeadline').isISO8601().withMessage('付款截止时间格式不正确'),
    body('location').isObject().withMessage('赛事地点不能为空'),
    body('location.city').notEmpty().withMessage('城市不能为空'),
    body('location.address').notEmpty().withMessage('详细地址不能为空'),
    body('organizer').notEmpty().withMessage('主办方不能为空'),
    body('organizerContact').notEmpty().withMessage('主办方联系电话不能为空'),
    body('totalCapacity').isInt({ min: 1 }).withMessage('总容量必须大于0'),
    validateRequest,
  ],
  update: [
    param('id').isMongoId().withMessage('赛事ID格式不正确'),
    validateRequest,
  ],
  idParam: [param('id').isMongoId().withMessage('ID格式不正确'), validateRequest],
};

export const raceController = {
  create: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    ...raceValidation.create,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const data = { ...req.body, createdBy: req.user!.userId };
        const race = await raceService.createRace(data);
        successResponse(res, race, '创建赛事成功', 201);
      } catch (error) {
        next(error);
      }
    },
  ],

  getById: [
    ...raceValidation.idParam,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const race = await raceService.getRaceById(req.params.id);
        if (!race) {
          errorResponse(res, '赛事不存在', 404);
          return;
        }
        successResponse(res, race);
      } catch (error) {
        next(error);
      }
    },
  ],

  getByCode: [
    param('code').notEmpty().withMessage('赛事代码不能为空'),
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const race = await raceService.getRaceByCode(req.params.code);
        if (!race) {
          errorResponse(res, '赛事不存在', 404);
          return;
        }
        successResponse(res, race);
      } catch (error) {
        next(error);
      }
    },
  ],

  list: [
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(Object.values(RaceStatus)),
    query('isPublished').optional().isBoolean(),
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await raceService.getRaces({
          page: parseInt(req.query.page as string) || 1,
          pageSize: parseInt(req.query.pageSize as string) || 20,
          status: req.query.status as RaceStatus,
          isPublished: req.query.isPublished === 'true',
          keyword: req.query.keyword as string,
          sortBy: req.query.sortBy as string,
          sortOrder: req.query.sortOrder as 'asc' | 'desc',
        });
        paginatedResponse(res, result);
      } catch (error) {
        next(error);
      }
    },
  ],

  listPublished: [
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 100 }),
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await raceService.getPublishedRaces({
          page: parseInt(req.query.page as string) || 1,
          pageSize: parseInt(req.query.pageSize as string) || 20,
          keyword: req.query.keyword as string,
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
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    ...raceValidation.update,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const race = await raceService.updateRace(req.params.id, req.body);
        if (!race) {
          errorResponse(res, '赛事不存在', 404);
          return;
        }
        successResponse(res, race, '更新赛事成功');
      } catch (error) {
        next(error);
      }
    },
  ],

  publish: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    ...raceValidation.idParam,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const race = await raceService.publishRace(req.params.id);
        if (!race) {
          errorResponse(res, '赛事不存在', 404);
          return;
        }
        successResponse(res, race, '赛事已发布');
      } catch (error) {
        next(error);
      }
    },
  ],

  openRegistration: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    ...raceValidation.idParam,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const race = await raceService.openRegistration(req.params.id);
        if (!race) {
          errorResponse(res, '赛事不存在', 404);
          return;
        }
        successResponse(res, race, '报名已开启');
      } catch (error) {
        next(error);
      }
    },
  ],

  closeRegistration: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    ...raceValidation.idParam,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const race = await raceService.closeRegistration(req.params.id);
        if (!race) {
          errorResponse(res, '赛事不存在', 404);
          return;
        }
        successResponse(res, race, '报名已关闭');
      } catch (error) {
        next(error);
      }
    },
  ],

  complete: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    ...raceValidation.idParam,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const race = await raceService.completeRace(req.params.id);
        if (!race) {
          errorResponse(res, '赛事不存在', 404);
          return;
        }
        successResponse(res, race, '赛事已标记完成');
      } catch (error) {
        next(error);
      }
    },
  ],

  cancel: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    ...raceValidation.idParam,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const race = await raceService.cancelRace(req.params.id);
        if (!race) {
          errorResponse(res, '赛事不存在', 404);
          return;
        }
        successResponse(res, race, '赛事已取消');
      } catch (error) {
        next(error);
      }
    },
  ],

  delete: [
    authMiddleware([Role.ADMIN]),
    ...raceValidation.idParam,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const deleted = await raceService.deleteRace(req.params.id);
        if (!deleted) {
          errorResponse(res, '赛事不存在', 404);
          return;
        }
        successResponse(res, null, '删除赛事成功');
      } catch (error) {
        next(error);
      }
    },
  ],

  getStatistics: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    ...raceValidation.idParam,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const stats = await raceService.getRaceStatistics(req.params.id);
        successResponse(res, stats);
      } catch (error) {
        next(error);
      }
    },
  ],
};
