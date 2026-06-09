import { Request, Response, NextFunction } from 'express';
import { body, param, query } from 'express-validator';
import { paymentService } from '../services/payment.service';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { successResponse, paginatedResponse, errorResponse } from '../utils/response';
import { Role, PaymentStatus, PaymentMethod } from '../types/enums';
import { AuthRequest } from '../types';

export const paymentController = {
  create: [
    authMiddleware([Role.USER, Role.ADMIN, Role.ORGANIZER, Role.VOLUNTEER]),
    body('raceId').isMongoId().withMessage('赛事ID格式不正确'),
    body('description').notEmpty().withMessage('订单描述不能为空'),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const userId = [Role.ADMIN, Role.ORGANIZER, Role.VOLUNTEER].includes(req.user!.role)
          ? req.body.userId || req.user!.userId
          : req.user!.userId;
        const payment = await paymentService.createPayment({
          ...req.body,
          userId,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        });
        successResponse(res, payment, '创建支付订单成功', 201);
      } catch (error) {
        next(error);
      }
    },
  ],

  getByOrderNo: [
    param('orderNo').notEmpty().withMessage('订单号不能为空'),
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const payment = await paymentService.getPaymentByOrderNo(req.params.orderNo);
        if (!payment) {
          errorResponse(res, '支付订单不存在', 404);
          return;
        }
        successResponse(res, payment);
      } catch (error) {
        next(error);
      }
    },
  ],

  getById: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER, Role.USER]),
    param('id').isMongoId().withMessage('订单ID格式不正确'),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const payment = await paymentService.getPaymentById(req.params.id);
        if (!payment) {
          errorResponse(res, '支付订单不存在', 404);
          return;
        }
        if (req.user!.role === Role.USER && payment.userId && payment.userId?.toString() !== req.user!.userId) {
          errorResponse(res, '无权查看此订单', 403);
          return;
        }
        successResponse(res, payment);
      } catch (error) {
        next(error);
      }
    },
  ],

  confirm: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    param('orderNo').notEmpty().withMessage('订单号不能为空'),
    body('transactionId').notEmpty().withMessage('交易流水号不能为空'),
    body('paidAmount').isInt({ min: 0 }).withMessage('支付金额不能为负'),
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await paymentService.confirmPayment(
          req.params.orderNo,
          req.body.transactionId,
          req.body.paidAmount,
          req.body.paymentMethod,
          req.body.gatewayResponse
        );
        successResponse(res, result, '支付确认成功');
      } catch (error) {
        next(error);
      }
    },
  ],

  callback: [
    param('orderNo').notEmpty().withMessage('订单号不能为空'),
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { transactionId, paidAmount, paymentMethod, status, gatewayResponse } = req.body;
        if (status === 'success') {
          const result = await paymentService.confirmPayment(
            req.params.orderNo,
            transactionId,
            paidAmount,
            paymentMethod,
            gatewayResponse
          );
          successResponse(res, { received: true, status: result.status });
        } else {
          const result = await paymentService.failPayment(req.params.orderNo, gatewayResponse);
          successResponse(res, { received: true, status: result.status });
        }
      } catch (error) {
        next(error);
      }
    },
  ],

  fail: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    param('orderNo').notEmpty().withMessage('订单号不能为空'),
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await paymentService.failPayment(req.params.orderNo, req.body.gatewayResponse);
        successResponse(res, result, '已标记支付失败');
      } catch (error) {
        next(error);
      }
    },
  ],

  myPayments: [
    authMiddleware([Role.USER]),
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(Object.values(PaymentStatus)),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const result = await paymentService.getUserPayments(req.user!.userId, {
          page: parseInt(req.query.page as string) || 1,
          pageSize: parseInt(req.query.pageSize as string) || 20,
          status: req.query.status as PaymentStatus,
        });
        paginatedResponse(res, result);
      } catch (error) {
        next(error);
      }
    },
  ],

  listByRace: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    param('raceId').isMongoId().withMessage('赛事ID格式不正确'),
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 500 }),
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await paymentService.getRacePayments(req.params.raceId, {
          page: parseInt(req.query.page as string) || 1,
          pageSize: parseInt(req.query.pageSize as string) || 50,
          status: req.query.status as PaymentStatus,
          method: req.query.method as PaymentMethod,
          keyword: req.query.keyword as string,
        });
        paginatedResponse(res, result);
      } catch (error) {
        next(error);
      }
    },
  ],

  createRefund: [
    authMiddleware([Role.USER, Role.ADMIN, Role.ORGANIZER]),
    body('paymentId').isMongoId().withMessage('支付订单ID格式不正确'),
    body('reason').notEmpty().withMessage('退款原因不能为空'),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const userId = [Role.ADMIN, Role.ORGANIZER].includes(req.user!.role)
          ? req.body.userId || req.user!.userId
          : req.user!.userId;
        const refund = await paymentService.createRefundRequest({
          ...req.body,
          userId,
        });
        successResponse(res, refund, '退款申请已提交', 201);
      } catch (error) {
        next(error);
      }
    },
  ],

  approveRefund: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    param('refundId').isMongoId().withMessage('退款申请ID格式不正确'),
    body('approvedAmount').isInt({ min: 0 }).withMessage('退款金额不能为负'),
    body('comment').optional().isString(),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const result = await paymentService.approveRefund(
          req.params.refundId,
          req.user!.userId,
          req.body.approvedAmount,
          req.body.comment
        );
        successResponse(res, result, '退款申请已批准');
      } catch (error) {
        next(error);
      }
    },
  ],

  rejectRefund: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    param('refundId').isMongoId().withMessage('退款申请ID格式不正确'),
    body('comment').notEmpty().isLength({ min: 5 }).withMessage('驳回原因至少5个字符'),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const result = await paymentService.rejectRefund(
          req.params.refundId,
          req.user!.userId,
          req.body.comment
        );
        successResponse(res, result, '退款申请已驳回');
      } catch (error) {
        next(error);
      }
    },
  ],

  processRefund: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    param('refundId').isMongoId().withMessage('退款申请ID格式不正确'),
    body('transactionId').optional().isString(),
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await paymentService.processRefund(
          req.params.refundId,
          req.body.transactionId,
          req.body.gatewayResponse
        );
        successResponse(res, result, '退款已执行完成');
      } catch (error) {
        next(error);
      }
    },
  ],

  listRefunds: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 200 }),
    query('raceId').optional().isMongoId(),
    query('status').optional().isIn(Object.values(PaymentStatus)),
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await paymentService.getRefundRequests({
          page: parseInt(req.query.page as string) || 1,
          pageSize: parseInt(req.query.pageSize as string) || 50,
          raceId: req.query.raceId as string,
          status: req.query.status as PaymentStatus,
        });
        paginatedResponse(res, result);
      } catch (error) {
        next(error);
      }
    },
  ],

  myRefunds: [
    authMiddleware([Role.USER]),
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 100 }),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const result = await paymentService.getRefundRequests({
          page: parseInt(req.query.page as string) || 1,
          pageSize: parseInt(req.query.pageSize as string) || 20,
          userId: req.user!.userId,
        });
        paginatedResponse(res, result);
      } catch (error) {
        next(error);
      }
    },
  ],
};
