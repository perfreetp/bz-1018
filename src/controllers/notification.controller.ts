import { Request, Response, NextFunction } from 'express';
import { body, param, query } from 'express-validator';
import { notificationService } from '../services/notification.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { successResponse, paginatedResponse, errorResponse } from '../utils/response';
import { Role, NotificationType, NotificationTemplate } from '../types/enums';
import { AuthRequest } from '../types';

export const notificationController = {
  send: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    body('type').isIn(Object.values(NotificationType)).withMessage('通知类型不正确'),
    body('template').isIn(Object.values(NotificationTemplate)).withMessage('模板不正确'),
    body('recipient').isObject().withMessage('接收人信息不能为空'),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const result = await notificationService.sendNotification({
          ...req.body,
          sentBy: req.user!.userId,
        });
        successResponse(res, result, '通知已发送', 201);
      } catch (error) {
        next(error);
      }
    },
  ],

  retry: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    param('id').isMongoId().withMessage('通知ID格式不正确'),
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await notificationService.retryNotification(req.params.id);
        successResponse(res, result, '通知已重发');
      } catch (error) {
        next(error);
      }
    },
  ],

  markRead: [
    authMiddleware([Role.USER, Role.ADMIN, Role.ORGANIZER, Role.VOLUNTEER, Role.CHECKER]),
    param('id').isMongoId().withMessage('通知ID格式不正确'),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const result = await notificationService.markAsRead(req.params.id, req.user!.userId);
        if (!result) {
          errorResponse(res, '通知不存在', 404);
          return;
        }
        successResponse(res, result, '已标记为已读');
      } catch (error) {
        next(error);
      }
    },
  ],

  myNotifications: [
    authMiddleware([Role.USER, Role.ADMIN, Role.ORGANIZER, Role.VOLUNTEER, Role.CHECKER]),
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 200 }),
    query('isRead').optional().isBoolean(),
    query('type').optional().isIn(Object.values(NotificationType)),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const result = await notificationService.getUserNotifications(req.user!.userId, {
          page: parseInt(req.query.page as string) || 1,
          pageSize: parseInt(req.query.pageSize as string) || 20,
          isRead: req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined,
          type: req.query.type as NotificationType,
        });
        paginatedResponse(res, result);
      } catch (error) {
        next(error);
      }
    },
  ],

  unreadCount: [
    authMiddleware([Role.USER, Role.ADMIN, Role.ORGANIZER, Role.VOLUNTEER, Role.CHECKER]),
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const count = await notificationService.getUnreadCount(req.user!.userId);
        successResponse(res, { count });
      } catch (error) {
        next(error);
      }
    },
  ],

  list: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 500 }),
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await notificationService.getNotifications({
          page: parseInt(req.query.page as string) || 1,
          pageSize: parseInt(req.query.pageSize as string) || 50,
          raceId: req.query.raceId as string,
          type: req.query.type as NotificationType,
          template: req.query.template as NotificationTemplate,
          sendStatus: req.query.sendStatus as string,
          keyword: req.query.keyword as string,
        });
        paginatedResponse(res, result);
      } catch (error) {
        next(error);
      }
    },
  ],

  batchSendByRace: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    body('raceId').isMongoId().withMessage('赛事ID格式不正确'),
    body('template').isIn(Object.values(NotificationTemplate)).withMessage('模板不正确'),
    body('type').optional().isIn(Object.values(NotificationType)),
    body('filters').optional().isObject(),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const result = await notificationService.batchSendByRace(
          req.body.raceId,
          req.body.template,
          req.body.type || NotificationType.SMS,
          req.body.filters,
          req.user!.userId
        );
        successResponse(res, result, `批量发送完成，已发送${result.queued}条`);
      } catch (error) {
        next(error);
      }
    },
  ],
};
