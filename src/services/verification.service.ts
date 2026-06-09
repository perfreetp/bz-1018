import mongoose from 'mongoose';
import { VerificationLog, IVerificationLog } from '../models/verification.model';
import { Registration, IRegistration } from '../models/registration.model';
import { Race } from '../models/race.model';
import { VerificationStatus } from '../types/enums';
import { PaginatedResult, PaginationParams } from '../types';
import { getPaginationInfo } from '../utils/response';
import { generateUUID, parsePickupToken } from '../utils/crypto';
import logger from '../utils/logger';

export interface VerifyPickupDto {
  registrationId?: string;
  registrationNo?: string;
  bibNumber?: string;
  pickupToken?: string;
  qrCode?: string;
  realName?: string;
  idNumber?: string;
  phone?: string;
  verifierId?: string;
  verifierName?: string;
  station: string;
  itemsPicked?: {
    name: string;
    quantity: number;
    size?: string;
  }[];
  deviceId?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  ipAddress?: string;
  notes?: string;
}

export interface OnsiteRegistrationDto {
  realName: string;
  phone: string;
  idDocument: {
    type: string;
    number: string;
  };
  raceId: string;
  categoryId: string;
  gender: string;
  verifierId?: string;
  verifierName?: string;
  station: string;
}

export class VerificationService {
  async verifyPickup(data: VerifyPickupDto): Promise<{
    status: VerificationStatus; message: string; registration?: IRegistration; log?: IVerificationLog;
  }> {
    let registration: IRegistration | null = null;

    if (data.pickupToken) {
      const parsed = parsePickupToken(data.pickupToken);
      if (parsed) {
        registration = await Registration.findById(parsed.registrationId)
          .populate('raceId', 'name code status')
          .populate('categoryId', 'name code distanceKm bibPrefix');
      }
    }

    if (!registration && data.registrationId) {
      registration = await Registration.findById(data.registrationId)
        .populate('raceId', 'name code status')
        .populate('categoryId', 'name code distanceKm bibPrefix');
    }

    if (!registration && data.registrationNo) {
      registration = await Registration.findOne({ registrationNo: data.registrationNo.toUpperCase() })
        .populate('raceId', 'name code status')
        .populate('categoryId', 'name code distanceKm bibPrefix');
    }

    if (!registration && data.bibNumber) {
      registration = await Registration.findOne({ bibNumber: data.bibNumber })
        .populate('raceId', 'name code status')
        .populate('categoryId', 'name code distanceKm bibPrefix');
    }

    if (!registration && data.realName && data.idNumber) {
      registration = await Registration.findOne({
        realName: data.realName,
        'idDocument.number': data.idNumber,
      })
        .populate('raceId', 'name code status')
        .populate('categoryId', 'name code distanceKm bibPrefix');
    }

    if (!registration && data.phone) {
      const candidates = await Registration.find({ phone: data.phone })
        .populate('raceId', 'name code status')
        .populate('categoryId', 'name code distanceKm bibPrefix');
      if (candidates.length === 1) {
        registration = candidates[0];
      } else if (candidates.length > 1 && data.realName) {
        registration = candidates.find((r) => r.realName === data.realName) || null;
      }
    }

    if (!registration) {
      return { status: VerificationStatus.INVALID, message: '未找到对应报名记录' };
    }

    if (registration.isCancelled) {
      return { status: VerificationStatus.INVALID, message: '该报名已取消', registration };
    }

    const race = registration.raceId as any;
    const raceStatus = race?.status;

    if (registration.isPickupVerified) {
      const prevLog = await VerificationLog.findOne({
        registrationId: registration._id,
        verificationType: 'pickup',
        status: VerificationStatus.VERIFIED,
      }).sort({ verifiedAt: -1 });

      return {
        status: VerificationStatus.ALREADY_VERIFIED, message: '该选手已完成领物核验', registration, log: prevLog || undefined,
      };
    }

    if (registration.reviewStatus !== 'approved') {
      return { status: VerificationStatus.INVALID, message: '报名资料尚未审核通过', registration };
    }

    if (registration.paymentStatus !== 'paid') {
      return { status: VerificationStatus.INVALID, message: '尚未完成缴费', registration };
    }

    if (!registration.bibNumber) {
      return { status: VerificationStatus.INVALID, message: '参赛号尚未分配', registration };
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await registration.markPickupVerified(
        new mongoose.Types.ObjectId(data.verifierId || '000000000000000000000000') as any,
        data.location
      );

      const log = new VerificationLog({
        verificationId: generateUUID(),
        raceId: registration.raceId,
        registrationId: registration._id,
        categoryId: registration.categoryId,
        bibNumber: registration.bibNumber,
        realName: registration.realName,
        verificationType: 'pickup',
        status: VerificationStatus.VERIFIED,
        qrCode: data.qrCode,
        pickupToken: data.pickupToken,
        itemsPicked: data.itemsPicked,
        verifierId: data.verifierId ? new mongoose.Types.ObjectId(data.verifierId) : undefined,
        verifierName: data.verifierName,
        station: data.station,
        deviceId: data.deviceId,
        location: data.location,
        latitude: data.latitude,
        longitude: data.longitude,
        ipAddress: data.ipAddress,
        notes: data.notes,
        previousStatus: VerificationStatus.NOT_VERIFIED,
        verifiedAt: new Date(),
      });

      await log.save({ session });
      await session.commitTransaction();
      session.endSession();

      logger.info(`领物核验成功: ${registration.registrationNo} - ${registration.realName} - 站点: ${data.station}`);

      return {
        status: VerificationStatus.VERIFIED, message: '核验成功，请发放参赛物品', registration, log,
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  async revertPickup(
    verificationId: string, operatorId: string, reason: string): Promise<IVerificationLog | null> {
    const log = await VerificationLog.findById(verificationId);
    if (!log) {
      throw new Error('核验记录不存在');
    }
    if (log.verificationType !== 'pickup') {
      throw new Error('只能撤销领物核验记录');
    }

    const registration = await Registration.findById(log.registrationId);
    if (registration) {
      registration.isPickupVerified = false;
      registration.pickupVerifiedAt = undefined;
      registration.pickupVerifiedBy = undefined;
      registration.pickupLocation = undefined;
      await registration.save();
    }

    log.status = VerificationStatus.INVALID;
    log.notes = `${log.notes || ''} | 撤销原因: ${reason} - 操作人: ${operatorId}`;
    await log.save();

    logger.info(`撤销领物核验: ${verificationId} - 原因: ${reason}`);
    return log;
  }

  async onsiteVerifyEntry(data: VerifyPickupDto): Promise<{
    status: VerificationStatus; message: string; registration?: IRegistration; log?: IVerificationLog }> {
    let registration: IRegistration | null = null;

    if (data.bibNumber) {
      registration = await Registration.findOne({ bibNumber: data.bibNumber })
        .populate('raceId', 'name code')
        .populate('categoryId', 'name code');
    }

    if (!registration && data.registrationNo) {
      registration = await Registration.findOne({ registrationNo: data.registrationNo.toUpperCase() })
        .populate('raceId', 'name code')
        .populate('categoryId', 'name code');
    }

    if (!registration && data.realName && data.idNumber) {
      registration = await Registration.findOne({
        realName: data.realName,
        'idDocument.number': data.idNumber,
      })
        .populate('raceId', 'name code')
        .populate('categoryId', 'name code');
    }

    if (!registration) {
      return { status: VerificationStatus.INVALID, message: '未找到报名记录' };
    }

    if (registration.isCancelled) {
      return { status: VerificationStatus.INVALID, message: '报名已取消', registration };
    }

    const existingEntry = await VerificationLog.findOne({
      registrationId: registration._id,
      verificationType: 'entry',
      status: VerificationStatus.VERIFIED,
    });

    if (existingEntry) {
      return {
        status: VerificationStatus.ALREADY_VERIFIED,
        message: '已完成入场核验', registration, log: existingEntry,
      };
    }

    if (!registration.isPickupVerified) {
      return { status: VerificationStatus.INVALID, message: '尚未领取参赛物品', registration };
    }

    const log = new VerificationLog({
      verificationId: generateUUID(),
      raceId: registration.raceId,
      registrationId: registration._id,
      categoryId: registration.categoryId,
      bibNumber: registration.bibNumber,
      realName: registration.realName,
      verificationType: 'entry',
      status: VerificationStatus.VERIFIED,
      verifierId: data.verifierId ? new mongoose.Types.ObjectId(data.verifierId) : undefined,
      verifierName: data.verifierName,
      station: data.station,
      location: data.location,
      verifiedAt: new Date(),
    });

    await log.save();

    logger.info(`入场核验: ${registration.bibNumber} - ${registration.realName}`);
    return { status: VerificationStatus.VERIFIED, message: '入场核验成功', registration, log };
  }

  async getVerificationLogs(
    params: PaginationParams & {
      raceId?: string;
      verificationType?: 'pickup' | 'entry' | 'onsite';
      status?: VerificationStatus;
      station?: string;
      verifierId?: string;
      keyword?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<PaginatedResult<IVerificationLog>> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 50;

    const filter: Record<string, any> = {};
    if (params.raceId) filter.raceId = params.raceId;
    if (params.verificationType) filter.verificationType = params.verificationType;
    if (params.status) filter.status = params.status;
    if (params.station) filter.station = params.station;
    if (params.verifierId) filter.verifierId = params.verifierId;
    if (params.keyword) {
      filter.$or = [
        { realName: { $regex: params.keyword, $options: 'i' } },
        { bibNumber: { $regex: params.keyword, $options: 'i' } },
      ];
    }
    if (params.startDate || params.endDate) {
      filter.verifiedAt = {};
      if (params.startDate) filter.verifiedAt.$gte = params.startDate;
      if (params.endDate) filter.verifiedAt.$lte = params.endDate;
    }

    const [total, logs] = await Promise.all([
      VerificationLog.countDocuments(filter),
      VerificationLog.find(filter)
        .populate('raceId', 'name code')
        .populate('categoryId', 'name code')
        .populate('verifierId', 'username realName')
        .sort({ verifiedAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    return {
      data: logs as any as IVerificationLog[],
      pagination: getPaginationInfo(page, pageSize, total),
    };
  }

  async getVerificationStatistics(raceId: string): Promise<{
    pickup: { total: number; verified: number; pending: number; byStation: Record<string, number> };
    entry: { total: number; verified: number; pending: number };
    byCategory: Record<string, { name: string; pickup: number; entry: number }>;
  }> {
    const [pickupLogs, entryLogs] = await Promise.all([
      VerificationLog.aggregate([
        { $match: { raceId: new mongoose.Types.ObjectId(raceId), verificationType: 'pickup' } },
        {
          $group: {
            _id: { status: '$status', station: '$station', categoryId: '$categoryId' },
            count: { $sum: 1 },
          },
        },
      ]),
      VerificationLog.aggregate([
        { $match: { raceId: new mongoose.Types.ObjectId(raceId), verificationType: 'entry' } },
        { $group: { _id: { status: '$status', categoryId: '$categoryId' }, count: { $sum: 1 } } },
      ]),
    ]);

    const registrations = await Registration.find({ raceId, isCancelled: false });
    const total = registrations.length;

    const pickupVerified = pickupLogs
      .filter((l) => l._id.status === VerificationStatus.VERIFIED)
      .reduce((sum, l) => sum + l.count, 0);

    const entryVerified = entryLogs
      .filter((l) => l._id.status === VerificationStatus.VERIFIED)
      .reduce((sum, l) => sum + l.count, 0);

    const byStation: Record<string, number> = {};
    pickupLogs
      .filter((l) => l._id.status === VerificationStatus.VERIFIED)
      .forEach((l) => {
        const station = l._id.station || '未知';
        byStation[station] = (byStation[station] || 0) + l.count;
      });

    return {
      pickup: {
        total,
        verified: pickupVerified,
        pending: total - pickupVerified,
        byStation,
      },
      entry: {
        total,
        verified: entryVerified,
        pending: total - entryVerified,
      },
      byCategory: {},
    };
  }

  async quickSearch(raceId: string, keyword: string): Promise<IRegistration[]> {
    const filter: Record<string, any> = { raceId, isCancelled: false };
    filter.$or = [
      { realName: { $regex: keyword, $options: 'i' } },
      { bibNumber: { $regex: keyword, $options: 'i' } },
      { registrationNo: { $regex: keyword, $options: 'i' } },
      { phone: { $regex: keyword } },
      { 'idDocument.number': { $regex: keyword } },
    ];

    return Registration.find(filter)
      .populate('categoryId', 'name code')
      .limit(20)
      .lean() as any as Promise<IRegistration[]>;
  }
}

export const verificationService = new VerificationService();
