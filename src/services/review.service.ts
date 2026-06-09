import mongoose from 'mongoose';
import { Registration, IRegistration } from '../models/registration.model';
import { Team, ITeam } from '../models/team.model';
import { RaceCategory } from '../models/raceCategory.model';
import { Race } from '../models/race.model';
import { ReviewStatus } from '../types/enums';
import { PaginatedResult, PaginationParams } from '../types';
import { getPaginationInfo } from '../utils/response';
import logger from '../utils/logger';

export class ReviewService {
  async approveRegistration(
    registrationId: string,
    adminId: string,
    comment?: string
  ): Promise<IRegistration> {
    const registration = await Registration.findById(registrationId);
    if (!registration) {
      throw new Error('报名记录不存在');
    }
    if (registration.reviewStatus === ReviewStatus.APPROVED) {
      throw new Error('该报名已审核通过');
    }
    if (registration.isCancelled) {
      throw new Error('该报名已取消');
    }

    await registration.approve(new mongoose.Types.ObjectId(adminId) as any, comment);

    logger.info(`审核通过报名: ${registration.registrationNo} - 审核人: ${adminId}`);
    return registration;
  }

  async rejectRegistration(
    registrationId: string,
    adminId: string,
    comment: string
  ): Promise<IRegistration> {
    if (!comment || comment.trim().length < 5) {
      throw new Error('驳回原因至少需要5个字符');
    }

    const registration = await Registration.findById(registrationId);
    if (!registration) {
      throw new Error('报名记录不存在');
    }
    if (registration.isCancelled) {
      throw new Error('该报名已取消');
    }

    await registration.reject(new mongoose.Types.ObjectId(adminId) as any, comment);

    logger.info(`审核驳回报名: ${registration.registrationNo} - 原因: ${comment}`);
    return registration;
  }

  async requireSupplement(
    registrationId: string,
    adminId: string,
    comment: string
  ): Promise<IRegistration> {
    if (!comment || comment.trim().length < 5) {
      throw new Error('补充资料说明至少需要5个字符');
    }

    const registration = await Registration.findById(registrationId);
    if (!registration) {
      throw new Error('报名记录不存在');
    }
    if (registration.isLocked) {
      throw new Error('参赛资料已锁定，无法要求补充');
    }

    registration.reviewStatus = ReviewStatus.SUPPLEMENT_REQUIRED;
    registration.reviewComment = comment;
    registration.reviewedBy = new mongoose.Types.ObjectId(adminId) as any;
    registration.reviewedAt = new Date();
    await registration.save();

    logger.info(`要求补充资料: ${registration.registrationNo}`);
    return registration;
  }

  async lockRegistration(registrationId: string, userId: string): Promise<IRegistration> {
    const registration = await Registration.findById(registrationId);
    if (!registration) {
      throw new Error('报名记录不存在');
    }
    if (registration.reviewStatus !== ReviewStatus.APPROVED) {
      throw new Error('审核通过后才能锁定参赛资料');
    }
    if (registration.isLocked) {
      return registration;
    }

    await registration.lock(new mongoose.Types.ObjectId(userId) as any);

    logger.info(`锁定参赛资料: ${registration.registrationNo} - 操作人: ${userId}`);
    return registration;
  }

  async unlockRegistration(registrationId: string, userId: string): Promise<IRegistration> {
    const registration = await Registration.findById(registrationId);
    if (!registration) {
      throw new Error('报名记录不存在');
    }
    if (!registration.isLocked) {
      return registration;
    }

    registration.isLocked = false;
    registration.lockedAt = undefined;
    registration.lockedBy = undefined;
    await registration.save();

    logger.info(`解锁参赛资料: ${registration.registrationNo} - 操作人: ${userId}`);
    return registration;
  }

  async assignBibNumber(
    registrationId: string,
    adminId: string,
    customBib?: string
  ): Promise<IRegistration> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const registration = await Registration.findById(registrationId).session(session);
      if (!registration) {
        throw new Error('报名记录不存在');
      }
      if (registration.reviewStatus !== ReviewStatus.APPROVED) {
        throw new Error('审核通过后才能分配参赛号');
      }
      if (registration.bibNumber) {
        throw new Error('参赛号已分配');
      }

      const category = await RaceCategory.findById(registration.categoryId).session(session);
      if (!category) {
        throw new Error('组别不存在');
      }

      let bibNumber: string;
      if (customBib) {
        const existing = await Registration.findOne({
          bibNumber: customBib,
          raceId: registration.raceId,
        }).session(session);
        if (existing) {
          throw new Error('该参赛号已被使用');
        }
        bibNumber = customBib;
      } else {
        bibNumber = category.generateBib(registration.gender);
        await category.save({ session });
      }

      registration.bibNumber = bibNumber;
      registration.bibAssignedAt = new Date();
      await registration.save({ session });

      await session.commitTransaction();
      session.endSession();

      logger.info(`分配参赛号: ${registration.registrationNo} -> ${bibNumber} - 操作人: ${adminId}`);
      return registration;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  async batchAssignBibNumbers(
    raceId: string,
    categoryId?: string,
    adminId?: string
  ): Promise<{ total: number; assigned: number; skipped: number }> {
    const filter: Record<string, any> = {
      raceId,
      reviewStatus: ReviewStatus.APPROVED,
      bibNumber: { $exists: false },
      isCancelled: false,
    };
    if (categoryId) {
      filter.categoryId = categoryId;
    }

    const registrations = await Registration.find(filter).sort({
      registrationType: -1,
      gender: 1,
      createdAt: 1,
    });

    let assigned = 0;
    let skipped = 0;

    for (const reg of registrations) {
      try {
        await this.assignBibNumber(reg._id.toString(), adminId || 'system');
        assigned++;
      } catch {
        skipped++;
      }
    }

    logger.info(`批量分配参赛号: 赛事${raceId} - 共${registrations.length}条，成功${assigned}条，跳过${skipped}条`);

    return {
      total: registrations.length,
      assigned,
      skipped,
    };
  }

  async batchApprove(
    raceId: string,
    filters: {
      categoryId?: string;
      paymentStatus?: string;
      registrationIds?: string[];
    },
    adminId: string
  ): Promise<{ total: number; approved: number; skipped: number; errors: string[] }> {
    const filter: Record<string, any> = {
      raceId,
      reviewStatus: ReviewStatus.PENDING,
      isCancelled: false,
    };
    if (filters.categoryId) filter.categoryId = filters.categoryId;
    if (filters.paymentStatus) filter.paymentStatus = filters.paymentStatus;
    if (filters.registrationIds && filters.registrationIds.length > 0) {
      filter._id = { $in: filters.registrationIds.map((id) => new mongoose.Types.ObjectId(id)) };
    }

    const registrations = await Registration.find(filter);
    const errors: string[] = [];
    let approved = 0;
    let skipped = 0;

    for (const reg of registrations) {
      try {
        await this.approveRegistration(reg._id.toString(), adminId);
        approved++;
      } catch (e: any) {
        errors.push(`${reg.registrationNo}: ${e.message}`);
        skipped++;
      }
    }

    return {
      total: registrations.length,
      approved,
      skipped,
      errors,
    };
  }

  async batchReject(
    registrationIds: string[],
    adminId: string,
    comment: string
  ): Promise<{ total: number; rejected: number; errors: string[] }> {
    const errors: string[] = [];
    let rejected = 0;

    for (const id of registrationIds) {
      try {
        await this.rejectRegistration(id, adminId, comment);
        rejected++;
      } catch (e: any) {
        errors.push(`${id}: ${e.message}`);
      }
    }

    return {
      total: registrationIds.length,
      rejected,
      errors,
    };
  }

  async getPendingReviews(
    raceId: string,
    params: PaginationParams & { categoryId?: string; requireProof?: boolean }
  ): Promise<PaginatedResult<IRegistration>> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 50;

    const filter: Record<string, any> = {
      raceId,
      reviewStatus: { $in: [ReviewStatus.PENDING, ReviewStatus.SUPPLEMENT_REQUIRED] },
      isCancelled: false,
    };
    if (params.categoryId) filter.categoryId = params.categoryId;
    if (params.requireProof !== undefined) {
      if (params.requireProof) {
        filter.$or = [
          { resultProof: { $exists: true, $ne: [] } },
          { medicalCertificate: { $exists: true } },
        ];
      }
    }

    const [total, registrations] = await Promise.all([
      Registration.countDocuments(filter),
      Registration.find(filter)
        .populate('categoryId', 'name code distanceKm')
        .populate('teamId', 'teamNo name')
        .sort({ reviewStatus: 1, createdAt: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    return {
      data: registrations as any as IRegistration[],
      pagination: getPaginationInfo(page, pageSize, total),
    };
  }

  async approveTeam(teamId: string, adminId: string, comment?: string): Promise<ITeam> {
    const team = await Team.findById(teamId);
    if (!team) {
      throw new Error('团队不存在');
    }
    if (!team.checkComplete()) {
      throw new Error(`团队人数不足最少要求的${team.minMembers}人`);
    }
    if (team.reviewStatus === ReviewStatus.APPROVED) {
      throw new Error('该团队已审核通过');
    }

    team.reviewStatus = ReviewStatus.APPROVED;
    team.reviewedBy = new mongoose.Types.ObjectId(adminId) as any;
    team.reviewedAt = new Date();
    if (comment) team.reviewComment = comment;
    await team.save();

    await Registration.updateMany(
      { teamId: team._id },
      { reviewStatus: ReviewStatus.APPROVED, reviewedBy: new mongoose.Types.ObjectId(adminId) as any, reviewedAt: new Date() }
    );

    logger.info(`审核通过团队: ${team.teamNo}`);
    return team;
  }

  async rejectTeam(teamId: string, adminId: string, comment: string): Promise<ITeam> {
    const team = await Team.findById(teamId);
    if (!team) {
      throw new Error('团队不存在');
    }

    team.reviewStatus = ReviewStatus.REJECTED;
    team.reviewedBy = new mongoose.Types.ObjectId(adminId) as any;
    team.reviewedAt = new Date();
    team.reviewComment = comment;
    await team.save();

    logger.info(`审核驳回团队: ${team.teamNo}`);
    return team;
  }
}

export const reviewService = new ReviewService();
