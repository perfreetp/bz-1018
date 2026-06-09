import { Request, Response, NextFunction } from 'express';
import { body, param, query } from 'express-validator';
import { raceCategoryService } from '../services/raceCategory.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { successResponse, paginatedResponse, errorResponse } from '../utils/response';
import { Role, Gender, ClothingSize, CategoryType } from '../types/enums';
import { AuthRequest } from '../types';

export const categoryValidation = {
  create: [
    body('raceId').isMongoId().withMessage('赛事ID格式不正确'),
    body('name').notEmpty().withMessage('组别名称不能为空'),
    body('code').notEmpty().withMessage('组别代码不能为空'),
    body('type').isIn(Object.values(CategoryType)).withMessage('组别类型不正确'),
    body('distanceKm').isFloat({ min: 0 }).withMessage('距离必须大于等于0'),
    body('capacity').isInt({ min: 1 }).withMessage('容量必须大于0'),
    body('price').isObject().withMessage('价格配置不能为空'),
    body('price.earlyBird').isInt({ min: 0 }).withMessage('早鸟价必须大于等于0'),
    body('price.regular').isInt({ min: 0 }).withMessage('常规价必须大于等于0'),
    body('allowedSizes').isArray({ min: 1 }).withMessage('至少指定一个衣服尺码'),
    body('bibPrefix').notEmpty().withMessage('参赛号前缀不能为空'),
    validateRequest,
  ],
  update: [
    param('id').isMongoId().withMessage('组别ID格式不正确'),
    validateRequest,
  ],
  idParam: [param('id').isMongoId().withMessage('ID格式不正确'), validateRequest],
};

export const raceCategoryController = {
  create: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    ...categoryValidation.create,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const category = await raceCategoryService.createCategory(req.body);
        successResponse(res, category, '创建组别成功', 201);
      } catch (error) {
        next(error);
      }
    },
  ],

  getById: [
    ...categoryValidation.idParam,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const category = await raceCategoryService.getCategoryById(req.params.id);
        if (!category) {
          errorResponse(res, '组别不存在', 404);
          return;
        }
        successResponse(res, category);
      } catch (error) {
        next(error);
      }
    },
  ],

  getByRace: [
    param('raceId').isMongoId().withMessage('赛事ID格式不正确'),
    query('includeInactive').optional().isBoolean(),
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const categories = await raceCategoryService.getCategoriesByRace(
          req.params.raceId,
          req.query.includeInactive === 'true'
        );
        successResponse(res, categories);
      } catch (error) {
        next(error);
      }
    },
  ],

  list: [
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 200 }),
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await raceCategoryService.getAllCategories({
          page: parseInt(req.query.page as string) || 1,
          pageSize: parseInt(req.query.pageSize as string) || 50,
          raceId: req.query.raceId as string,
          isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
          type: req.query.type as CategoryType,
          sortBy: req.query.sortBy as string,
          sortOrder: req.query.sortOrder as 'asc' | 'desc',
        });
        paginatedResponse(res, result);
      } catch (error) {
        next(error);
      }
    },
  ],

  update: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    ...categoryValidation.update,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const category = await raceCategoryService.updateCategory(req.params.id, req.body);
        if (!category) {
          errorResponse(res, '组别不存在', 404);
          return;
        }
        successResponse(res, category, '更新组别成功');
      } catch (error) {
        next(error);
      }
    },
  ],

  activate: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    ...categoryValidation.idParam,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const category = await raceCategoryService.activateCategory(req.params.id);
        if (!category) {
          errorResponse(res, '组别不存在', 404);
          return;
        }
        successResponse(res, category, '组别已启用');
      } catch (error) {
        next(error);
      }
    },
  ],

  deactivate: [
    authMiddleware([Role.ADMIN, Role.ORGANIZER]),
    ...categoryValidation.idParam,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const category = await raceCategoryService.deactivateCategory(req.params.id);
        if (!category) {
          errorResponse(res, '组别不存在', 404);
          return;
        }
        successResponse(res, category, '组别已停用');
      } catch (error) {
        next(error);
      }
    },
  ],

  delete: [
    authMiddleware([Role.ADMIN]),
    ...categoryValidation.idParam,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const deleted = await raceCategoryService.deleteCategory(req.params.id);
        if (!deleted) {
          errorResponse(res, '组别不存在', 404);
          return;
        }
        successResponse(res, null, '删除组别成功');
      } catch (error) {
        next(error);
      }
    },
  ],

  checkCapacity: [
    ...categoryValidation.idParam,
    query('gender').optional().isIn(Object.values(Gender)),
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await raceCategoryService.checkCapacity(
          req.params.id,
          req.query.gender as Gender
        );
        successResponse(res, result);
      } catch (error) {
        next(error);
      }
    },
  ],

  getPrice: [
    ...categoryValidation.idParam,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await raceCategoryService.getCategoryPrice(req.params.id);
        successResponse(res, result);
      } catch (error) {
        next(error);
      }
    },
  ],
};
