import { Race, IRace } from '../models/race.model';
import { RaceCategory, IRaceCategory } from '../models/raceCategory.model';
import { Registration } from '../models/registration.model';
import { PaginatedResult, PaginationParams } from '../types';
import { RaceStatus } from '../types/enums';
import { getPaginationInfo } from '../utils/response';
import logger from '../utils/logger';

export interface CreateRaceDto {
  name: string;
  code: string;
  edition: string;
  tagline?: string;
  description?: string;
  rules?: string;
  raceDate: Date;
  registrationStartTime: Date;
  registrationEndTime: Date;
  paymentDeadline: Date;
  reviewStartTime?: Date;
  reviewEndTime?: Date;
  pickupStartTime?: Date;
  pickupEndTime?: Date;
  location: {
    city: string;
    district?: string;
    address: string;
    latitude?: number;
    longitude?: number;
  };
  organizer: string;
  organizerContact: string;
  organizerEmail?: string;
  coverImage?: string;
  bannerImage?: string;
  images?: string[];
  isTeamRegistrationAllowed?: boolean;
  maxTeamSize?: number;
  minTeamSize?: number;
  requireProofDocument?: boolean;
  requireMedicalCertificate?: boolean;
  tags?: string[];
  totalCapacity: number;
  createdBy: string;
  sortOrder?: number;
}

export interface UpdateRaceDto extends Partial<CreateRaceDto> {
  status?: RaceStatus;
  isPublished?: boolean;
}

export class RaceService {
  async createRace(data: CreateRaceDto): Promise<IRace> {
    const race = new Race({
      ...data,
      status: RaceStatus.DRAFT,
      isPublished: false,
      totalRegistered: 0,
    });

    await race.save();
    logger.info(`创建赛事成功: ${race.name} (${race._id})`);
    return race;
  }

  async getRaceById(id: string): Promise<IRace | null> {
    return Race.findById(id);
  }

  async getRaceByCode(code: string): Promise<IRace | null> {
    return Race.findOne({ code: code.toUpperCase() });
  }

  async getRaces(
    params: PaginationParams & {
      status?: RaceStatus;
      isPublished?: boolean;
      keyword?: string;
    }
  ): Promise<PaginatedResult<IRace>> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const sortBy = params.sortBy || 'sortOrder';
    const sortOrder = params.sortOrder === 'asc' ? 1 : -1;

    const filter: Record<string, any> = {};

    if (params.status) {
      filter.status = params.status;
    }

    if (params.isPublished !== undefined) {
      filter.isPublished = params.isPublished;
    }

    if (params.keyword) {
      filter.$or = [
        { name: { $regex: params.keyword, $options: 'i' } },
        { code: { $regex: params.keyword, $options: 'i' } },
        { tags: { $in: [new RegExp(params.keyword, 'i')] } },
      ];
    }

    const [total, races] = await Promise.all([
      Race.countDocuments(filter),
      Race.find(filter)
        .sort({ [sortBy]: sortOrder, createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    return {
      data: races as any as IRace[],
      pagination: getPaginationInfo(page, pageSize, total),
    };
  }

  async getPublishedRaces(
    params: PaginationParams & { keyword?: string }
  ): Promise<PaginatedResult<IRace>> {
    return this.getRaces({
      ...params,
      isPublished: true,
    });
  }

  async updateRace(id: string, data: UpdateRaceDto): Promise<IRace | null> {
    const race = await Race.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, runValidators: true }
    );

    if (race) {
      logger.info(`更新赛事: ${race.name} (${race._id})`);
    }

    return race;
  }

  async publishRace(id: string): Promise<IRace | null> {
    return this.updateRace(id, {
      isPublished: true,
      status: RaceStatus.PUBLISHED,
    });
  }

  async openRegistration(id: string): Promise<IRace | null> {
    return this.updateRace(id, {
      status: RaceStatus.REGISTRATION_OPEN,
    });
  }

  async closeRegistration(id: string): Promise<IRace | null> {
    return this.updateRace(id, {
      status: RaceStatus.REGISTRATION_CLOSED,
    });
  }

  async startReview(id: string): Promise<IRace | null> {
    return this.updateRace(id, {
      status: RaceStatus.REVIEWING,
    });
  }

  async completeRace(id: string): Promise<IRace | null> {
    return this.updateRace(id, {
      status: RaceStatus.COMPLETED,
    });
  }

  async cancelRace(id: string): Promise<IRace | null> {
    return this.updateRace(id, {
      status: RaceStatus.CANCELLED,
      isPublished: false,
    });
  }

  async deleteRace(id: string): Promise<boolean> {
    const categories = await RaceCategory.countDocuments({ raceId: id });
    if (categories > 0) {
      throw new Error('请先删除该赛事下的所有组别');
    }

    const registrations = await Registration.countDocuments({ raceId: id });
    if (registrations > 0) {
      throw new Error('该赛事已有报名记录，无法删除');
    }

    const result = await Race.findByIdAndDelete(id);
    if (result) {
      logger.info(`删除赛事: ${result.name} (${result._id})`);
    }
    return !!result;
  }

  async updateTotalCapacity(raceId: string): Promise<void> {
    const categories = await RaceCategory.find({ raceId });
    const totalCapacity = categories.reduce((sum, c) => sum + c.capacity, 0);
    const totalRegistered = categories.reduce((sum, c) => sum + c.registered, 0);

    await Race.findByIdAndUpdate(raceId, {
      totalCapacity,
      totalRegistered,
    });
  }

  async getRaceStatistics(raceId: string): Promise<{
    totalCapacity: number;
    totalRegistered: number;
    capacityUsed: number;
    categories: {
      id: string;
      name: string;
      code: string;
      capacity: number;
      registered: number;
      maleRegistered: number;
      femaleRegistered: number;
    }[];
    reviewStats: {
      pending: number;
      approved: number;
      rejected: number;
    };
    paymentStats: {
      unpaid: number;
      pending: number;
      paid: number;
      refunded: number;
    };
  }> {
    const categories = await RaceCategory.find({ raceId }).lean();
    const race = await Race.findById(raceId);

    if (!race) {
      throw new Error('赛事不存在');
    }

    const categoryStats = categories.map((c: any) => ({
      id: c._id.toString(),
      name: c.name,
      code: c.code,
      capacity: c.capacity,
      registered: c.registered,
      maleRegistered: c.maleRegistered || 0,
      femaleRegistered: c.femaleRegistered || 0,
    }));

    const categoryIds = categories.map((c) => c._id);

    const [reviewStats, paymentStats] = await Promise.all([
      Registration.aggregate([
        { $match: { categoryId: { $in: categoryIds } } },
        { $group: { _id: '$reviewStatus', count: { $sum: 1 } } },
      ]),
      Registration.aggregate([
        { $match: { categoryId: { $in: categoryIds } } },
        { $group: { _id: '$paymentStatus', count: { $sum: 1 } } },
      ]),
    ]);

    const reviewMap = Object.fromEntries(reviewStats.map((r) => [r._id, r.count]));
    const paymentMap = Object.fromEntries(paymentStats.map((p) => [p._id, p.count]));

    return {
      totalCapacity: race.totalCapacity,
      totalRegistered: race.totalRegistered,
      capacityUsed: race.totalCapacity > 0 ? (race.totalRegistered / race.totalCapacity) * 100 : 0,
      categories: categoryStats,
      reviewStats: {
        pending: reviewMap['pending'] || 0,
        approved: reviewMap['approved'] || 0,
        rejected: reviewMap['rejected'] || 0,
      },
      paymentStats: {
        unpaid: paymentMap['unpaid'] || 0,
        pending: paymentMap['pending'] || 0,
        paid: paymentMap['paid'] || 0,
        refunded: paymentMap['refunded'] || 0,
      },
    };
  }
}

export const raceService = new RaceService();
