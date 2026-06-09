import mongoose from 'mongoose';
import { RaceCategory, IRaceCategory } from '../models/raceCategory.model';
import { Race } from '../models/race.model';
import { Registration } from '../models/registration.model';
import { PaginatedResult, PaginationParams } from '../types';
import { getPaginationInfo } from '../utils/response';
import { raceService } from './race.service';
import logger from '../utils/logger';
import { Gender } from '../types/enums';

export interface CreateCategoryDto {
  raceId: string;
  name: string;
  code: string;
  type: string;
  distanceKm: number;
  description?: string;
  routeDescription?: string;
  startTime?: string;
  capacity: number;
  maleCapacity?: number;
  femaleCapacity?: number;
  waitlistCapacity?: number;
  price: {
    earlyBird: number;
    regular: number;
    late?: number;
  };
  earlyBirdEndDate?: Date;
  allowedGenders?: Gender[];
  ageLimit?: { min?: number; max?: number };
  allowedSizes: string[];
  requireProof?: boolean;
  minCompletionTime?: number;
  cutOffTime?: string;
  prizes?: { position: number; amount: number; description?: string }[];
  bibPrefix: string;
  sortOrder?: number;
}

export interface UpdateCategoryDto extends Partial<CreateCategoryDto> {
  isActive?: boolean;
}

export class RaceCategoryService {
  async createCategory(data: CreateCategoryDto): Promise<IRaceCategory> {
    const race = await Race.findById(data.raceId);
    if (!race) {
      throw new Error('赛事不存在');
    }

    const existing = await RaceCategory.findOne({
      raceId: data.raceId,
      code: data.code.toUpperCase(),
    });
    if (existing) {
      throw new Error('该组别代码在当前赛事中已存在');
    }

    const category = new RaceCategory({
      ...data,
      code: data.code.toUpperCase(),
      bibPrefix: data.bibPrefix.toUpperCase(),
      registered: 0,
      maleRegistered: 0,
      femaleRegistered: 0,
      waitlistRegistered: 0,
      nextBibSequence: 1,
      isActive: true,
    });

    await category.save();
    await raceService.updateTotalCapacity(data.raceId);

    logger.info(`创建组别成功: ${category.name} (${category._id}) - 赛事: ${race.name}`);
    return category;
  }

  async getCategoryById(id: string): Promise<IRaceCategory | null> {
    return RaceCategory.findById(id).populate('raceId', 'name code status');
  }

  async getCategoryByCode(raceId: string, code: string): Promise<IRaceCategory | null> {
    return RaceCategory.findOne({
      raceId,
      code: code.toUpperCase(),
    });
  }

  async getCategoriesByRace(
    raceId: string,
    includeInactive: boolean = false
  ): Promise<IRaceCategory[]> {
    const filter: Record<string, any> = { raceId };
    if (!includeInactive) {
      filter.isActive = true;
    }
    return RaceCategory.find(filter).sort({ sortOrder: 1, createdAt: 1 });
  }

  async getAllCategories(
    params: PaginationParams & {
      raceId?: string;
      isActive?: boolean;
      type?: string;
    }
  ): Promise<PaginatedResult<IRaceCategory>> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 50;
    const sortBy = params.sortBy || 'sortOrder';
    const sortOrder = params.sortOrder === 'asc' ? 1 : -1;

    const filter: Record<string, any> = {};

    if (params.raceId) {
      filter.raceId = params.raceId;
    }
    if (params.isActive !== undefined) {
      filter.isActive = params.isActive;
    }
    if (params.type) {
      filter.type = params.type;
    }

    const [total, categories] = await Promise.all([
      RaceCategory.countDocuments(filter),
      RaceCategory.find(filter)
        .populate('raceId', 'name code status raceDate')
        .sort({ [sortBy]: sortOrder, createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    return {
      data: categories as any as IRaceCategory[],
      pagination: getPaginationInfo(page, pageSize, total),
    };
  }

  async updateCategory(id: string, data: UpdateCategoryDto): Promise<IRaceCategory | null> {
    if (data.code) {
      data.code = data.code.toUpperCase();
    }
    if (data.bibPrefix) {
      data.bibPrefix = data.bibPrefix.toUpperCase();
    }

    const category = await RaceCategory.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, runValidators: true }
    );

    if (category) {
      await raceService.updateTotalCapacity(category.raceId.toString());
      logger.info(`更新组别: ${category.name} (${category._id})`);
    }

    return category;
  }

  async deactivateCategory(id: string): Promise<IRaceCategory | null> {
    return this.updateCategory(id, { isActive: false });
  }

  async activateCategory(id: string): Promise<IRaceCategory | null> {
    return this.updateCategory(id, { isActive: true });
  }

  async deleteCategory(id: string): Promise<boolean> {
    const category = await RaceCategory.findById(id);
    if (!category) {
      return false;
    }

    const registrations = await Registration.countDocuments({
      categoryId: id,
      isCancelled: false,
    });
    if (registrations > 0) {
      throw new Error('该组别已有报名记录，无法删除');
    }

    const raceId = category.raceId.toString();
    await RaceCategory.findByIdAndDelete(id);
    await raceService.updateTotalCapacity(raceId);

    logger.info(`删除组别: ${category.name} (${id})`);
    return true;
  }

  async checkCapacity(categoryId: string, gender?: Gender): Promise<{
    available: boolean;
    capacity: number;
    registered: number;
    waitlistAvailable: boolean;
    waitlistCapacity: number;
    waitlistRegistered: number;
  }> {
    const category = await RaceCategory.findById(categoryId);
    if (!category) {
      throw new Error('组别不存在');
    }

    let available = !category.isFull();
    if (gender && (category.maleCapacity || category.femaleCapacity)) {
      available = !category.isGenderFull(gender);
    }

    return {
      available,
      capacity: category.capacity,
      registered: category.registered,
      waitlistAvailable:
        category.waitlistCapacity !== undefined &&
        (category.waitlistRegistered || 0) < category.waitlistCapacity,
      waitlistCapacity: category.waitlistCapacity || 0,
      waitlistRegistered: category.waitlistRegistered || 0,
    };
  }

  async incrementRegistered(categoryId: string, gender?: Gender, session?: mongoose.ClientSession): Promise<boolean> {
    const category = await RaceCategory.findById(categoryId).session(session || undefined);
    if (!category) {
      throw new Error('组别不存在');
    }

    const updateFilter: Record<string, any> = {
      _id: new mongoose.Types.ObjectId(categoryId),
      isActive: true,
    };

    const updateOperation: Record<string, any> = {
      $inc: { registered: 1 },
    };

    updateFilter.$expr = { $lt: ['$registered', '$capacity'] };

    if (gender === Gender.MALE && category.maleCapacity !== undefined) {
      updateFilter.$and = updateFilter.$and || [];
      updateFilter.$and.push({
        $expr: { $lt: [{ $ifNull: ['$maleRegistered', 0] }, '$maleCapacity'] },
      });
      updateOperation.$inc.maleRegistered = 1;
    }

    if (gender === Gender.FEMALE && category.femaleCapacity !== undefined) {
      updateFilter.$and = updateFilter.$and || [];
      updateFilter.$and.push({
        $expr: { $lt: [{ $ifNull: ['$femaleRegistered', 0] }, '$femaleCapacity'] },
      });
      updateOperation.$inc.femaleRegistered = 1;
    }

    const options: Record<string, any> = { new: true };
    if (session) {
      options.session = session;
    }

    const result = await RaceCategory.findOneAndUpdate(
      updateFilter,
      updateOperation,
      options
    );

    const success = !!result;
    if (success) {
      await raceService.updateTotalCapacity(category.raceId.toString());
    }
    return success;
  }

  async decrementRegistered(categoryId: string, gender?: Gender, session?: mongoose.ClientSession): Promise<void> {
    const updateOperation: Record<string, any> = {
      $inc: { registered: -1 },
    };
    if (gender === Gender.MALE) {
      updateOperation.$inc.maleRegistered = -1;
    }
    if (gender === Gender.FEMALE) {
      updateOperation.$inc.femaleRegistered = -1;
    }

    const category = await RaceCategory.findById(categoryId).session(session || undefined);
    if (!category) {
      return;
    }

    const filter: Record<string, any> = { _id: new mongoose.Types.ObjectId(categoryId) };
    filter.registered = { $gt: 0 };
    if (gender === Gender.MALE) {
      filter.maleRegistered = { $gt: 0 };
    }
    if (gender === Gender.FEMALE) {
      filter.femaleRegistered = { $gt: 0 };
    }

    const options: Record<string, any> = {};
    if (session) {
      options.session = session;
    }

    await RaceCategory.findOneAndUpdate(filter, updateOperation, options);
    await raceService.updateTotalCapacity(category.raceId.toString());
  }

  async generateBib(categoryId: string, gender?: Gender): Promise<string | null> {
    const category = await RaceCategory.findById(categoryId);
    if (!category) {
      return null;
    }
    const bib = category.generateBib(gender);
    await category.save();
    return bib;
  }

  async getCategoryPrice(categoryId: string): Promise<{
    currentPrice: number;
    price: { earlyBird: number; regular: number; late?: number };
    isEarlyBird: boolean;
    earlyBirdEndDate?: Date;
  }> {
    const category = await RaceCategory.findById(categoryId);
    if (!category) {
      throw new Error('组别不存在');
    }

    const isEarlyBird =
      category.earlyBirdEndDate !== undefined && new Date() <= category.earlyBirdEndDate;

    return {
      currentPrice: category.getCurrentPrice(),
      price: category.price,
      isEarlyBird,
      earlyBirdEndDate: category.earlyBirdEndDate,
    };
  }
}

export const raceCategoryService = new RaceCategoryService();
