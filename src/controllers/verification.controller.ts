import { Request, Response, NextFunction } from 'express';
import { body, param, query } from 'express-validator';
import { verificationService } from '../services/verification.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { successResponse, paginatedResponse, errorResponse } from '../utils/response';
import { Role, VerificationStatus } from '../types/enums';
import { AuthRequest } from '../types';

export const verificationController = {
  verifyPickup: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER, Role.VOLUNTEER, Role.CHECKER]),
    body('station').notEmpty().withMessage('核验站点不能为空'),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const result = await verificationService.verifyPickup({
          ...req.body,
          verifierId: req.user!.userId,
          verifierName: (req.user as any)?.realName,
          ipAddress: req.ip,
        });
        const codeMap: Record<VerificationStatus, number> = {
          [VerificationStatus.VERIFIED]: 200,
          [VerificationStatus.ALREADY_VERIFIED]: 200,
          [VerificationStatus.NOT_VERIFIED]: 400,
          [VerificationStatus.PENDING]: 400,
          [VerificationStatus.INVALID]: 400,
        };
        successResponse(res, result, result.message, codeMap[result.status]);
      } catch (error) {
        next(error);
      }
    },
  ],

  revertPickup: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    param('verificationId').isMongoId().withMessage('核验ID格式不正确'),
    body('reason').notEmpty().isLength({ min: 5 }).withMessage('撤销原因至少5个字符'),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const result = await verificationService.revertPickup(
          req.params.verificationId,
          req.user!.userId,
          req.body.reason
        );
        if (!result) {
          errorResponse(res, '核验记录不存在', 404);
          return;
        }
        successResponse(res, result, '已撤销领物核验');
      } catch (error) {
        next(error);
      }
    },
  ],

  verifyEntry: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER, Role.VOLUNTEER, Role.CHECKER]),
    body('station').notEmpty().withMessage('核验站点不能为空'),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const result = await verificationService.onsiteVerifyEntry({
          ...req.body,
          verifierId: req.user!.userId,
          verifierName: (req.user as any)?.realName,
          ipAddress: req.ip,
        });
        successResponse(res, result, result.message);
      } catch (error) {
        next(error);
      }
    },
  ],

  logs: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER, Role.VOLUNTEER, Role.CHECKER]),
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 1000 }),
    query('raceId').optional().isMongoId(),
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await verificationService.getVerificationLogs({
          page: parseInt(req.query.page as string) || 1,
          pageSize: parseInt(req.query.pageSize as string) || 50,
          raceId: req.query.raceId as string,
          verificationType: req.query.verificationType as 'pickup' | 'entry' | 'onsite',
          status: req.query.status as VerificationStatus,
          station: req.query.station as string,
          verifierId: req.query.verifierId as string,
          keyword: req.query.keyword as string,
          startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
          endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        });
        paginatedResponse(res, result);
      } catch (error) {
        next(error);
      }
    },
  ],

  statistics: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    param('raceId').isMongoId().withMessage('赛事ID格式不正确'),
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const stats = await verificationService.getVerificationStatistics(req.params.raceId);
        successResponse(res, stats);
      } catch (error) {
        next(error);
      }
    },
  ],

  quickSearch: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER, Role.VOLUNTEER, Role.CHECKER]),
    param('raceId').isMongoId().withMessage('赛事ID格式不正确'),
    query('keyword').notEmpty().withMessage('搜索关键词不能为空'),
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await verificationService.quickSearch(
          req.params.raceId,
          req.query.keyword as string
        );
        successResponse(res, result);
      } catch (error) {
        next(error);
      }
    },
  ],
};
