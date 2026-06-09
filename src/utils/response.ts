import { Response } from 'express';
import { ApiResponse, PaginationInfo, PaginatedResult } from '../types';

export function successResponse<T>(
  res: Response,
  data: T,
  message: string = '操作成功',
  code: number = 200
): Response<ApiResponse<T>> {
  return res.status(code).json({
    success: true,
    data,
    message,
    code,
    timestamp: new Date().toISOString(),
  });
}

export function paginatedResponse<T>(
  res: Response,
  result: PaginatedResult<T>,
  message: string = '查询成功',
  code: number = 200
): Response<ApiResponse<T[]>> {
  return res.status(code).json({
    success: true,
    data: result.data,
    message,
    code,
    timestamp: new Date().toISOString(),
    pagination: result.pagination,
  });
}

export function errorResponse(
  res: Response,
  message: string = '操作失败',
  code: number = 500,
  errors?: any
): Response<ApiResponse> {
  return res.status(code).json({
    success: false,
    message,
    code,
    timestamp: new Date().toISOString(),
    errors,
  });
}

export function getPaginationInfo(
  page: number,
  pageSize: number,
  total: number
): PaginationInfo {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}
