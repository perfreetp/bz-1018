import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { Role } from '../types/enums';
import { verifyToken } from '../utils/crypto';
import { errorResponse } from '../utils/response';
import logger from '../utils/logger';

export function authMiddleware(requiredRoles?: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        next({ statusCode: 401, message: '未提供有效的认证令牌' });
        return;
      }

      const token = authHeader.split(' ')[1];
      const payload = verifyToken(token);

      if (!payload) {
        next({ statusCode: 401, message: '认证令牌无效或已过期' });
        return;
      }

      if (requiredRoles && requiredRoles.length > 0) {
        if (!payload.role || !requiredRoles.includes(payload.role)) {
          next({ statusCode: 403, message: '权限不足，无法执行此操作' });
          return;
        }
      }

      (req as AuthRequest).user = payload;
      next();
    } catch (error) {
      logger.error('认证中间件错误:', error);
      next({ statusCode: 500, message: '认证过程中发生错误' });
    }
  };
}

export function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const payload = verifyToken(token);
      if (payload) {
        (req as AuthRequest).user = payload;
      }
    }

    next();
  } catch {
    next();
  }
}
