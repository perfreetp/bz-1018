import { Request, Response, NextFunction } from 'express';
import { body, param, query } from 'express-validator';
import { authService } from '../services/auth.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { successResponse, paginatedResponse, errorResponse } from '../utils/response';
import { Role } from '../types/enums';
import { AuthRequest } from '../types';

export const authValidation = {
  register: [
    body('username').isLength({ min: 3, max: 50 }).withMessage('用户名长度3-50个字符'),
    body('phone').matches(/^1[3-9]\d{9}$/).withMessage('手机号格式不正确'),
    body('email').optional().isEmail().withMessage('邮箱格式不正确'),
    body('password').isLength({ min: 6 }).withMessage('密码长度至少6位'),
    body('realName').optional().isString(),
    body('role').optional().isIn(Object.values(Role)),
    validateRequest,
  ],
  login: [
    body('account').notEmpty().withMessage('账号不能为空'),
    body('password').notEmpty().withMessage('密码不能为空'),
    validateRequest,
  ],
  changePassword: [
    body('oldPassword').notEmpty().withMessage('原密码不能为空'),
    body('newPassword').isLength({ min: 6 }).withMessage('新密码长度至少6位'),
    validateRequest,
  ],
};

export const authController = {
  register: [
    ...authValidation.register,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (req.body.role && ![Role.USER].includes(req.body.role) && !req.headers['x-admin-secret']) {
          delete req.body.role;
        }
        const result = await authService.register(req.body);
        successResponse(res, result, '注册成功', 201);
      } catch (error) {
        next(error);
      }
    },
  ],

  login: [
    ...authValidation.login,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await authService.login({
          account: req.body.account,
          password: req.body.password,
          ip: req.ip,
        });
        successResponse(res, result, '登录成功');
      } catch (error) {
        next(error);
      }
    },
  ],

  me: [
    authMiddleware([Role.USER, Role.ADMIN, Role.ORGANIZER, Role.VOLUNTEER, Role.CHECKER]),
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const user = await authService.getCurrentUser(req.user!.userId);
        if (!user) {
          errorResponse(res, '用户不存在', 404);
          return;
        }
        successResponse(res, user);
      } catch (error) {
        next(error);
      }
    },
  ],

  updateProfile: [
    authMiddleware([Role.USER, Role.ADMIN, Role.ORGANIZER, Role.VOLUNTEER, Role.CHECKER]),
    body('realName').optional().isString(),
    body('avatar').optional().isString(),
    body('email').optional().isEmail(),
    body('phone').optional().matches(/^1[3-9]\d{9}$/),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const user = await authService.updateProfile(req.user!.userId, req.body);
        if (!user) {
          errorResponse(res, '用户不存在', 404);
          return;
        }
        successResponse(res, user, '更新资料成功');
      } catch (error) {
        next(error);
      }
    },
  ],

  changePassword: [
    authMiddleware([Role.USER, Role.ADMIN, Role.ORGANIZER, Role.VOLUNTEER, Role.CHECKER]),
    ...authValidation.changePassword,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        await authService.changePassword(
          req.user!.userId,
          req.body.oldPassword,
          req.body.newPassword
        );
        successResponse(res, null, '修改密码成功');
      } catch (error) {
        next(error);
      }
    },
  ],

  listUsers: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 500 }),
    query('role').optional().isIn(Object.values(Role)),
    query('isActive').optional().isBoolean(),
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await authService.getAllUsers({
          page: parseInt(req.query.page as string) || 1,
          pageSize: parseInt(req.query.pageSize as string) || 50,
          role: req.query.role as Role,
          isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
          keyword: req.query.keyword as string,
        });
        paginatedResponse(res, result);
      } catch (error) {
        next(error);
      }
    },
  ],

  toggleStatus: [
    authMiddleware([Role.ADMIN]),
    param('userId').isMongoId().withMessage('用户ID格式不正确'),
    body('isActive').isBoolean().withMessage('状态参数不正确'),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const user = await authService.toggleUserStatus(
          req.params.userId,
          req.body.isActive,
          req.user!.userId
        );
        if (!user) {
          errorResponse(res, '用户不存在', 404);
          return;
        }
        successResponse(res, user, req.body.isActive ? '已启用用户' : '已禁用用户');
      } catch (error) {
        next(error);
      }
    },
  ],

  assignRole: [
    authMiddleware([Role.ADMIN]),
    param('userId').isMongoId().withMessage('用户ID格式不正确'),
    body('role').isIn(Object.values(Role)).withMessage('角色不正确'),
    validateRequest,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
      try {
        const user = await authService.assignRole(
          req.params.userId,
          req.body.role,
          req.user!.userId
        );
        if (!user) {
          errorResponse(res, '用户不存在', 404);
          return;
        }
        successResponse(res, user, '角色分配成功');
      } catch (error) {
        next(error);
      }
    },
  ],
};
