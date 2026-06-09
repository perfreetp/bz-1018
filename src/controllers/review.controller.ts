import { Request, Response, NextFunction } from 'express';
import { body, param, query } from 'express-validator';
import { reviewService } from '../services/review.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { successResponse, paginatedResponse, errorResponse } from '../utils/response';
import { Role } from '../types/enums';
import { AuthRequest } from '../types';

export const reviewController = {
  approve: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    param('id').isMongoId().withMessage('报名ID格式不正确'),
    body('comment').optional().isString(),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const result = await reviewService.approveRegistration(
          req.params.id,
          req.user!.userId,
          req.body.comment
        );
        successResponse(res, result, '审核通过');
      } catch (error) {
        next(error);
      }
    },
  ],

  reject: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    param('id').isMongoId().withMessage('报名ID格式不正确'),
    body('comment').notEmpty().isLength({ min: 5 }).withMessage('驳回原因至少5个字符'),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const result = await reviewService.rejectRegistration(
          req.params.id,
          req.user!.userId,
          req.body.comment
        );
        successResponse(res, result, '已驳回');
      } catch (error) {
        next(error);
      }
    },
  ],

  requireSupplement: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    param('id').isMongoId().withMessage('报名ID格式不正确'),
    body('comment').notEmpty().isLength({ min: 5 }).withMessage('补充说明至少5个字符'),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const result = await reviewService.requireSupplement(
          req.params.id,
          req.user!.userId,
          req.body.comment
        );
        successResponse(res, result, '已要求补充资料');
      } catch (error) {
        next(error);
      }
    },
  ],

  lock: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    param('id').isMongoId().withMessage('报名ID格式不正确'),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const result = await reviewService.lockRegistration(req.params.id, req.user!.userId);
        successResponse(res, result, '参赛资料已锁定');
      } catch (error) {
        next(error);
      }
    },
  ],

  unlock: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    param('id').isMongoId().withMessage('报名ID格式不正确'),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const result = await reviewService.unlockRegistration(req.params.id, req.user!.userId);
        successResponse(res, result, '参赛资料已解锁');
      } catch (error) {
        next(error);
      }
    },
  ],

  assignBib: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    param('id').isMongoId().withMessage('报名ID格式不正确'),
    body('customBib').optional().isString(),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const result = await reviewService.assignBibNumber(
          req.params.id,
          req.user!.userId,
          req.body.customBib
        );
        successResponse(res, result, `参赛号已分配: ${result.bibNumber}`);
      } catch (error) {
        next(error);
      }
    },
  ],

  batchAssignBib: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    body('raceId').isMongoId().withMessage('赛事ID格式不正确'),
    body('categoryId').optional().isMongoId(),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const result = await reviewService.batchAssignBibNumbers(
          req.body.raceId,
          req.body.categoryId,
          req.user!.userId
        );
        successResponse(res, result, `批量分配参赛号完成，成功${result.assigned}条`);
      } catch (error) {
        next(error);
      }
    },
  ],

  batchApprove: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    body('raceId').isMongoId().withMessage('赛事ID格式不正确'),
    body('filters').optional().isObject(),
    body('registrationIds').optional().isArray(),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const result = await reviewService.batchApprove(
          req.body.raceId,
          req.body.filters || { registrationIds: req.body.registrationIds },
          req.user!.userId
        );
        successResponse(res, result, `批量审核完成，通过${result.approved}条`);
      } catch (error) {
        next(error);
      }
    },
  ],

  batchReject: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    body('registrationIds').isArray({ min: 1 }).withMessage('请选择报名记录'),
    body('comment').notEmpty().isLength({ min: 5 }).withMessage('驳回原因至少5个字符'),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const result = await reviewService.batchReject(
          req.body.registrationIds,
          req.user!.userId,
          req.body.comment
        );
        successResponse(res, result, `批量驳回完成，成功${result.rejected}条`);
      } catch (error) {
        next(error);
      }
    },
  ],

  pendingList: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER, Role.VOLUNTEER]),
    param('raceId').isMongoId().withMessage('赛事ID格式不正确'),
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 500 }),
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await reviewService.getPendingReviews(req.params.raceId, {
          page: parseInt(req.query.page as string) || 1,
          pageSize: parseInt(req.query.pageSize as string) || 50,
          categoryId: req.query.categoryId as string,
          requireProof: req.query.requireProof === 'true',
        });
        paginatedResponse(res, result);
      } catch (error) {
        next(error);
      }
    },
  ],

  approveTeam: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    param('teamId').isMongoId().withMessage('团队ID格式不正确'),
    body('comment').optional().isString(),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const result = await reviewService.approveTeam(
          req.params.teamId,
          req.user!.userId,
          req.body.comment
        );
        successResponse(res, result, '团队审核通过');
      } catch (error) {
        next(error);
      }
    },
  ],

  rejectTeam: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    param('teamId').isMongoId().withMessage('团队ID格式不正确'),
    body('comment').notEmpty().isLength({ min: 5 }).withMessage('驳回原因至少5个字符'),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const result = await reviewService.rejectTeam(
          req.params.teamId,
          req.user!.userId,
          req.body.comment
        );
        successResponse(res, result, '团队已驳回');
      } catch (error) {
        next(error);
      }
    },
  ],
};
