import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { errorResponse } from '../utils/response';

export function validateRequest(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: (err as any).path || err.msg,
      message: err.msg,
    }));

    errorResponse(res, '请求参数验证失败', 400, formattedErrors);
    return;
  }

  next();
}
