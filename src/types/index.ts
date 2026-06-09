import { Request } from 'express';
import { Role } from '../types/enums';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
  code: number;
  timestamp: string;
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface JwtPayload {
  userId: string;
  role: Role;
  email?: string;
  phone?: string;
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export interface IdCardValidationResult {
  valid: boolean;
  message?: string;
  parsedData?: {
    provinceCode: string;
    birthDate: string;
    gender: string;
    age: number;
  };
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationInfo;
}
