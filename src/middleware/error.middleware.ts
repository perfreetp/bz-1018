import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { errorResponse } from '../utils/response';
import logger from '../utils/logger';

export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    message: '请求过于频繁，请稍后再试',
    code: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: '登录尝试次数过多，请15分钟后再试',
    code: 429,
  },
});

export function notFoundHandler(_req: Request, res: Response): void {
  errorResponse(res, '请求的资源不存在', 404);
}

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || '服务器内部错误';

  if (statusCode >= 500) {
    logger.error('服务器错误:', err);
  } else if (statusCode >= 400) {
    logger.warn('客户端错误:', { statusCode, message, stack: err.stack });
  }

  if (err.name === 'ValidationError') {
    const errors = Object.values((err as any).errors).map((e: any) => ({
      field: e.path,
      message: e.message,
    }));
    errorResponse(res, '数据验证失败', 400, errors);
    return;
  }

  if (err.code === 11000) {
    const keyPattern = err.keyPattern || {};
    const keys = Object.keys(keyPattern).join(', ');
    errorResponse(res, `数据唯一性冲突: ${keys} 已存在`, 409);
    return;
  }

  if (err.name === 'CastError') {
    errorResponse(res, '无效的资源标识符格式', 400);
    return;
  }

  errorResponse(res, message, statusCode, err.errors);
}
