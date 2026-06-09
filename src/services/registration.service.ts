import mongoose from 'mongoose';
import { Registration, IRegistration } from '../models/registration.model';
import { Team, ITeam } from '../models/team.model';
import { Race } from '../models/race.model';
import { RaceCategory } from '../models/raceCategory.model';
import { PaginatedResult, PaginationParams } from '../types';
import { RegistrationType, ReviewStatus, PaymentStatus, Gender, IDType, ClothingSize } from '../types/enums';
import { getPaginationInfo } from '../utils/response';
import { validateIdCard, validatePhone, validatePassport, validateEmail } from '../utils/validators';
import { generateUUID, generatePickupToken, generateQRCodeData } from '../utils/crypto';
import { raceCategoryService } from './raceCategory.service';
import logger from '../utils/logger';

export interface EmergencyContactDto {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

export interface IdDocumentDto {
  type: IDType;
  number: string;
  issueDate?: Date;
  expiryDate?: Date;
}

export interface CreateRegistrationDto {
  userId?: string;
  raceId: string;
  categoryId: string;
  registrationType: RegistrationType;
  teamId?: string;
  realName: string;
  gender: Gender;
  birthDate: Date;
  idDocument: IdDocumentDto;
  nationality?: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  province?: string;
  zipCode?: string;
  occupation?: string;
  company?: string;
  emergencyContact: EmergencyContactDto;
  clothingSize: ClothingSize;
  resultProof?: {
    raceName: string;
    raceDate: Date;
    completionTime: string;
    certificateUrl?: string;
    distanceKm: number;
  }[];
  medicalCertificate?: {
    certificateUrl: string;
    issueDate: Date;
    expiryDate?: Date;
    hospital: string;
    doctorName?: string;
  };
  photoUrl?: string;
  waiverSigned: boolean;
  source?: 'website' | 'volunteer' | 'offline';
  registeredBy?: string;
}

export interface UpdateRegistrationDto {
  realName?: string;
  gender?: Gender;
  birthDate?: Date;
  idDocument?: IdDocumentDto;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  province?: string;
  zipCode?: string;
  occupation?: string;
  company?: string;
  emergencyContact?: EmergencyContactDto;
  clothingSize?: ClothingSize;
  resultProof?: any[];
  medicalCertificate?: any;
  photoUrl?: string;
  note?: string;
}

export interface CreateTeamDto {
  userId: string;
  raceId: string;
  categoryId: string;
  name: string;
  description?: string;
  slogan?: string;
  logoUrl?: string;
  captainRegistrationId: string;
}

export class RegistrationService {
  private validateRegistrationData(data: CreateRegistrationDto): void {
    if (!data.waiverSigned) {
      throw new Error('请先阅读并签署参赛免责声明');
    }

    if (!validatePhone(data.phone)) {
      throw new Error('手机号码格式不正确');
    }

    if (data.email && !validateEmail(data.email)) {
      throw new Error('邮箱格式不正确');
    }

    if (!validatePhone(data.emergencyContact.phone)) {
      throw new Error('紧急联系人手机号格式不正确');
    }

    if (data.idDocument.type === IDType.ID_CARD) {
      const idResult = validateIdCard(data.idDocument.number);
      if (!idResult.valid) {
        throw new Error(idResult.message);
      }

      if (idResult.parsedData) {
        const parsedDate = new Date(idResult.parsedData.birthDate);
        if (
          parsedDate.getFullYear() !== data.birthDate.getFullYear() ||
          parsedDate.getMonth() !== data.birthDate.getMonth() ||
          parsedDate.getDate() !== data.birthDate.getDate()
        ) {
          throw new Error('出生日期与身份证信息不匹配');
        }

        const idGender = idResult.parsedData.gender === 'male' ? Gender.MALE : Gender.FEMALE;
        if (data.gender !== idGender) {
          throw new Error('性别与身份证信息不匹配');
        }
      }
    } else if (data.idDocument.type === IDType.PASSPORT) {
      if (!validatePassport(data.idDocument.number)) {
        throw new Error('护照号格式不正确');
      }
    }
  }

  private calculateAge(birthDate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return Math.max(0, Math.min(150, age));
  }

  private generateRegistrationNo(raceId: string): string {
    const raceSuffix = raceId.slice(-6).toUpperCase();
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `MR${raceSuffix}${timestamp}${random}`;
  }

  async createIndividualRegistration(data: CreateRegistrationDto): Promise<IRegistration> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      this.validateRegistrationData(data);

      const [race, category] = await Promise.all([
        Race.findById(data.raceId).session(session),
        RaceCategory.findById(data.categoryId).session(session),
      ]);

      if (!race) {
        throw new Error('赛事不存在');
      }
      if (!category) {
        throw new Error('组别不存在');
      }
      if (!race.isRegistrationOpen()) {
        throw new Error('当前不在报名时间内');
      }
      if (!category.isActive) {
        throw new Error('该组别当前不接受报名');
      }
      if (category.isFull()) {
        throw new Error('该组别名额已满');
      }
      if (category.isGenderFull(data.gender)) {
        throw new Error('该性别组名额已满');
      }

      if (category.allowedGenders && category.allowedGenders.length > 0) {
        if (!category.allowedGenders.includes(data.gender)) {
          throw new Error('该组别不允许此性别报名');
        }
      }

      const age = this.calculateAge(new Date(data.birthDate));
      if (category.ageLimit) {
        if (category.ageLimit.min !== undefined && age < category.ageLimit.min) {
          throw new Error(`年龄小于该组别最低要求${category.ageLimit.min}岁`);
        }
        if (category.ageLimit.max !== undefined && age > category.ageLimit.max) {
          throw new Error(`年龄超过该组别最高限制${category.ageLimit.max}岁`);
        }
      }

      if (category.allowedSizes && !category.allowedSizes.includes(data.clothingSize)) {
        throw new Error('选择的衣服尺码不在可用范围内');
      }

      if (category.requireProof && (!data.resultProof || data.resultProof.length === 0)) {
        throw new Error('该组别需要提交成绩证明');
      }

      if (race.requireMedicalCertificate && !data.medicalCertificate) {
        throw new Error('需要提交体检证明');
      }

      const existing = await Registration.findOne({
        raceId: data.raceId,
        'idDocument.type': data.idDocument.type,
        'idDocument.number': data.idDocument.number,
        isCancelled: false,
      }).session(session);

      if (existing) {
        throw new Error('该证件号在此赛事中已有报名记录');
      }

      const registered = await raceCategoryService.incrementRegistered(
        data.categoryId,
        data.gender,
        session
      );
      if (!registered) {
        if (category.isGenderFull(data.gender)) {
          throw new Error('该性别组名额已满');
        }
        throw new Error('该组别名额已满');
      }

      const price = category.getCurrentPrice();
      const paymentDueDate = new Date(Math.min(
        new Date().getTime() + 72 * 60 * 60 * 1000,
        race.paymentDeadline.getTime()
      ));

      const registrationNo = this.generateRegistrationNo(data.raceId);

      const registration = new Registration({
        ...data,
        registrationNo,
        registrationType: RegistrationType.INDIVIDUAL,
        age,
        price,
        paymentDueDate,
        reviewStatus: ReviewStatus.PENDING,
        paymentStatus: PaymentStatus.UNPAID,
        isLocked: false,
        isPickupVerified: false,
        isCancelled: false,
      });

      await registration.save({ session });
      await session.commitTransaction();
      session.endSession();

      logger.info(`个人报名成功: ${registration.registrationNo} - ${registration.realName}`);
      return registration;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  async getRegistrationById(id: string): Promise<IRegistration | null> {
    return Registration.findById(id)
      .populate('raceId', 'name code status raceDate')
      .populate('categoryId', 'name code distanceKm bibPrefix');
  }

  async getRegistrationByNo(registrationNo: string): Promise<IRegistration | null> {
    return Registration.findOne({ registrationNo: registrationNo.toUpperCase() })
      .populate('raceId', 'name code status raceDate')
      .populate('categoryId', 'name code distanceKm bibPrefix');
  }

  async getUserRegistrations(
    userId: string,
    params: PaginationParams
  ): Promise<PaginatedResult<IRegistration>> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;

    const filter: Record<string, any> = { userId, isCancelled: false };

    const [total, registrations] = await Promise.all([
      Registration.countDocuments(filter),
      Registration.find(filter)
        .populate('raceId', 'name code status raceDate location coverImage')
        .populate('categoryId', 'name code distanceKm')
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    return {
      data: registrations as any as IRegistration[],
      pagination: getPaginationInfo(page, pageSize, total),
    };
  }

  async getRaceRegistrations(
    raceId: string,
    params: PaginationParams & {
      categoryId?: string;
      reviewStatus?: ReviewStatus;
      paymentStatus?: PaymentStatus;
      registrationType?: RegistrationType;
      isLocked?: boolean;
      isPickupVerified?: boolean;
      isCancelled?: boolean;
      keyword?: string;
      bibNumber?: string;
      phone?: string;
      idNumber?: string;
    }
  ): Promise<PaginatedResult<IRegistration>> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 50;
    const sortBy = params.sortBy || 'createdAt';
    const sortOrder = params.sortOrder === 'asc' ? 1 : -1;

    const filter: Record<string, any> = { raceId };

    if (params.categoryId) filter.categoryId = params.categoryId;
    if (params.reviewStatus) filter.reviewStatus = params.reviewStatus;
    if (params.paymentStatus) filter.paymentStatus = params.paymentStatus;
    if (params.registrationType) filter.registrationType = params.registrationType;
    if (params.isLocked !== undefined) filter.isLocked = params.isLocked;
    if (params.isPickupVerified !== undefined) filter.isPickupVerified = params.isPickupVerified;
    if (params.isCancelled !== undefined) filter.isCancelled = params.isCancelled;
    else filter.isCancelled = false;

    if (params.keyword) {
      filter.$or = [
        { realName: { $regex: params.keyword, $options: 'i' } },
        { phone: { $regex: params.keyword } },
        { registrationNo: { $regex: params.keyword, $options: 'i' } },
      ];
    }
    if (params.bibNumber) filter.bibNumber = params.bibNumber;
    if (params.phone) filter.phone = { $regex: params.phone };
    if (params.idNumber) filter['idDocument.number'] = params.idNumber;

    const [total, registrations] = await Promise.all([
      Registration.countDocuments(filter),
      Registration.find(filter)
        .populate('categoryId', 'name code distanceKm')
        .populate('teamId', 'teamNo name')
        .populate('reviewedBy', 'username realName')
        .populate('lockedBy', 'username realName')
        .sort({ [sortBy]: sortOrder })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    return {
      data: registrations as any as IRegistration[],
      pagination: getPaginationInfo(page, pageSize, total),
    };
  }

  async updateRegistration(id: string, data: UpdateRegistrationDto): Promise<IRegistration | null> {
    const registration = await Registration.findById(id);
    if (!registration) {
      return null;
    }

    if (!registration.canEdit()) {
      throw new Error('当前报名状态不允许修改资料');
    }

    const merged = {
      realName: data.realName ?? registration.realName,
      gender: data.gender ?? registration.gender,
      birthDate: data.birthDate ?? registration.birthDate,
      idDocument: data.idDocument ?? registration.idDocument,
      phone: data.phone ?? registration.phone,
      email: data.email ?? registration.email,
      address: data.address ?? registration.address,
      city: data.city ?? registration.city,
      province: data.province ?? registration.province,
      zipCode: data.zipCode ?? registration.zipCode,
      occupation: data.occupation ?? registration.occupation,
      company: data.company ?? registration.company,
      emergencyContact: data.emergencyContact ?? registration.emergencyContact,
      clothingSize: data.clothingSize ?? registration.clothingSize,
      resultProof: data.resultProof ?? registration.resultProof,
      medicalCertificate: data.medicalCertificate ?? registration.medicalCertificate,
      photoUrl: data.photoUrl ?? registration.photoUrl,
      note: data.note ?? registration.note,
    };

    const errors: string[] = [];

    if (!/^1[3-9]\d{9}$/.test(merged.phone)) {
      errors.push('手机号格式不正确');
    }

    if (merged.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(merged.email)) {
      errors.push('邮箱格式不正确');
    }

    if (!/^1[3-9]\d{9}$/.test(merged.emergencyContact.phone)) {
      errors.push('紧急联系人手机号格式不正确');
    }

    if (merged.idDocument?.type === IDType.ID_CARD && merged.idDocument?.number) {
      const idResult = validateIdCard(merged.idDocument.number);
      if (!idResult.valid) {
        errors.push(idResult.message || '身份证号无效');
      } else if (idResult.parsedData) {
        const parsedDate = new Date(idResult.parsedData.birthDate);
        const birthDate = new Date(merged.birthDate);
        if (
          parsedDate.getFullYear() !== birthDate.getFullYear() ||
          parsedDate.getMonth() !== birthDate.getMonth() ||
          parsedDate.getDate() !== birthDate.getDate()
        ) {
          errors.push('出生日期与身份证信息不匹配');
        }
        const idGender = idResult.parsedData.gender === 'male' ? Gender.MALE : Gender.FEMALE;
        if (merged.gender !== idGender) {
          errors.push('性别与身份证信息不匹配');
        }
      }
    }

    if (merged.idDocument?.type === IDType.PASSPORT && merged.idDocument?.number) {
      if (!/^(G|D|S|P|H|M|E)\d{8}$/.test(merged.idDocument.number.trim().toUpperCase())) {
        errors.push('护照号格式不正确');
      }
    }

    const category = await RaceCategory.findById(registration.categoryId);
    if (category && category.allowedSizes && category.allowedSizes.length > 0) {
      if (!category.allowedSizes.includes(merged.clothingSize as ClothingSize)) {
        errors.push(`衣服尺码 ${merged.clothingSize} 不在允许范围内: ${category.allowedSizes.join(', ')}`);
      }
    }

    if (category && category.ageLimit) {
      const age = this.calculateAge(new Date(merged.birthDate));
      if (category.ageLimit.min !== undefined && age < category.ageLimit.min) {
        errors.push(`年龄小于组别最低要求${category.ageLimit.min}岁`);
      }
      if (category.ageLimit.max !== undefined && age > category.ageLimit.max) {
        errors.push(`年龄超过组别最高限制${category.ageLimit.max}岁`);
      }
    }

    if (errors.length > 0) {
      throw new Error(errors.join('；'));
    }

    const recalculatedAge = this.calculateAge(new Date(merged.birthDate));

    return Registration.findByIdAndUpdate(
      id,
      {
        $set: {
          ...merged,
          age: recalculatedAge,
        },
      },
      { new: true, runValidators: true }
    );
  }

  async cancelRegistration(id: string, reason: string, adminId?: string): Promise<boolean> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const registration = await Registration.findById(id).session(session);
      if (!registration) {
        throw new Error('报名记录不存在');
      }
      if (registration.isCancelled) {
        throw new Error('该报名已取消');
      }
      if (registration.isLocked) {
        throw new Error('参赛资料已锁定，无法取消');
      }

      registration.isCancelled = true;
      registration.cancelledAt = new Date();
      registration.cancellationReason = reason;
      registration.reviewStatus = ReviewStatus.REJECTED;
      if (adminId) {
        registration.reviewedBy = new mongoose.Types.ObjectId(adminId) as unknown as typeof registration.reviewedBy;
        registration.reviewedAt = new Date();
      }
      await registration.save({ session });

      await raceCategoryService.decrementRegistered(
        registration.categoryId.toString(),
        registration.gender,
        session
      );

      await session.commitTransaction();
      session.endSession();

      logger.info(`取消报名: ${registration.registrationNo} - 原因: ${reason}`);
      return true;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  async generatePickupQRCode(id: string): Promise<{ qrCode: string; pickupToken: string; bibNumber?: string }> {
    const registration = await Registration.findById(id);
    if (!registration) {
      throw new Error('报名记录不存在');
    }
    if (registration.reviewStatus !== ReviewStatus.APPROVED) {
      throw new Error('报名尚未审核通过');
    }
    if (registration.paymentStatus !== PaymentStatus.PAID) {
      throw new Error('尚未完成缴费');
    }
    if (!registration.bibNumber) {
      throw new Error('参赛号尚未分配');
    }

    const pickupToken = generatePickupToken(id);
    const qrData = JSON.stringify({
      registrationNo: registration.registrationNo,
      bibNumber: registration.bibNumber,
      pickupToken,
      timestamp: Date.now(),
    });
    const qrCode = await generateQRCodeData(qrData);

    registration.pickupToken = pickupToken;
    registration.qrCode = qrCode;
    await registration.save();

    return {
      qrCode,
      pickupToken,
      bibNumber: registration.bibNumber,
    };
  }

  async createTeam(data: CreateTeamDto): Promise<ITeam> {
    const [race, category, captainReg] = await Promise.all([
      Race.findById(data.raceId),
      RaceCategory.findById(data.categoryId),
      Registration.findById(data.captainRegistrationId),
    ]);

    if (!race) throw new Error('赛事不存在');
    if (!category) throw new Error('组别不存在');
    if (!race.isTeamRegistrationAllowed) throw new Error('该赛事不接受团队报名');
    if (category.raceId?.toString() !== data.raceId) throw new Error('组别不属于该赛事');
    if (!captainReg) throw new Error('队长报名记录不存在');
    if (!captainReg.userId || captainReg.userId?.toString() !== data.userId) {
      throw new Error('只能用自己的报名记录创建团队');
    }
    if (captainReg.raceId?.toString() !== data.raceId) {
      throw new Error('队长报名赛事与团队赛事不一致');
    }
    if (captainReg.categoryId?.toString() !== data.categoryId) {
      throw new Error('队长报名组别与团队组别不一致');
    }

    const existingTeam = await Team.findOne({
      raceId: data.raceId,
      name: data.name,
      isCancelled: false,
    });
    if (existingTeam) {
      throw new Error('该团队名称在当前赛事中已存在');
    }

    const memberCapRegs = await Registration.countDocuments({
      teamId: { $ne: null },
      registrationType: RegistrationType.TEAM,
      isCancelled: false,
    });

    const teamNo = `TM${data.raceId.slice(-4).toUpperCase()}${Date.now().toString().slice(-6)}`;

    const team = new Team({
      teamNo,
      name: data.name,
      raceId: data.raceId,
      categoryId: data.categoryId,
      captainId: data.userId,
      captainRegistrationId: data.captainRegistrationId,
      description: data.description,
      slogan: data.slogan,
      logoUrl: data.logoUrl,
      members: [
        {
          registrationId: data.captainRegistrationId,
          isCaptain: true,
          joinedAt: new Date(),
        },
      ],
      memberCount: 1,
      maxMembers: race.maxTeamSize || 10,
      minMembers: race.minTeamSize || 3,
      isComplete: false,
      reviewStatus: ReviewStatus.PENDING,
      paymentStatus: PaymentStatus.UNPAID,
      totalAmount: category.getCurrentPrice(),
      isCancelled: false,
    });

    await team.save();

    captainReg.teamId = team._id as any;
    captainReg.registrationType = RegistrationType.TEAM;
    await captainReg.save();

    logger.info(`创建团队: ${team.teamNo} - ${team.name}`);
    return team;
  }

  async addTeamMember(teamId: string, registrationId: string, userId: string): Promise<ITeam> {
    const [team, registration] = await Promise.all([
      Team.findById(teamId),
      Registration.findById(registrationId),
    ]);

    if (!team) throw new Error('团队不存在');
    if (!registration) throw new Error('报名记录不存在');
    if (team.isCancelled) throw new Error('团队已取消');
    if (!registration.userId || registration.userId?.toString() !== userId) {
      throw new Error('只能为自己报名的记录加入团队');
    }
    if (registration.raceId?.toString() !== team.raceId.toString()) {
      throw new Error('报名赛事与团队赛事不一致');
    }
    if (registration.categoryId?.toString() !== team.categoryId.toString()) {
      throw new Error('报名组别与团队组别不一致');
    }
    if (registration.teamId) {
      throw new Error('该报名已加入其他团队');
    }

    const added = await team.addMember(new mongoose.Types.ObjectId(registrationId) as any);
    if (!added) {
      throw new Error('加入团队失败，团队可能已满或您已在团队中');
    }

    registration.teamId = team._id as any;
    registration.registrationType = RegistrationType.TEAM;
    await registration.save();

    return team;
  }

  async removeTeamMember(teamId: string, registrationId: string, userId: string): Promise<ITeam> {
    const team = await Team.findById(teamId);
    if (!team) throw new Error('团队不存在');
    if (team.captainId?.toString() !== userId) {
      throw new Error('只有队长可以移除成员');
    }

    await team.removeMember(new mongoose.Types.ObjectId(registrationId) as any);

    const registration = await Registration.findById(registrationId);
    if (registration) {
      registration.teamId = undefined;
      registration.registrationType = RegistrationType.INDIVIDUAL;
      await registration.save();
    }

    return team;
  }

  async getTeamById(id: string): Promise<ITeam | null> {
    return Team.findById(id)
      .populate('captainId', 'username realName phone')
      .populate('members.registrationId', 'registrationNo realName gender bibNumber reviewStatus paymentStatus');
  }

  async getUserTeams(userId: string): Promise<ITeam[]> {
    return Team.find({ captainId: userId, isCancelled: false })
      .populate('raceId', 'name code status raceDate')
      .populate('categoryId', 'name code')
      .sort({ createdAt: -1 });
  }

  async getRaceTeams(
    raceId: string,
    params: PaginationParams & { reviewStatus?: ReviewStatus; paymentStatus?: PaymentStatus; keyword?: string }
  ): Promise<PaginatedResult<ITeam>> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 50;

    const filter: Record<string, any> = { raceId, isCancelled: false };
    if (params.reviewStatus) filter.reviewStatus = params.reviewStatus;
    if (params.paymentStatus) filter.paymentStatus = params.paymentStatus;
    if (params.keyword) {
      filter.$or = [
        { name: { $regex: params.keyword, $options: 'i' } },
        { teamNo: { $regex: params.keyword, $options: 'i' } },
      ];
    }

    const [total, teams] = await Promise.all([
      Team.countDocuments(filter),
      Team.find(filter)
        .populate('categoryId', 'name code')
        .populate('captainId', 'realName phone')
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    return {
      data: teams as any as ITeam[],
      pagination: getPaginationInfo(page, pageSize, total),
    };
  }

  async getGroupStatistics(raceId: string): Promise<any> {
    const categories = await RaceCategory.find({ raceId });
    const categoryIds = categories.map((c) => c._id);

    const stats = await Registration.aggregate([
      { $match: { categoryId: { $in: categoryIds }, isCancelled: false } },
      {
        $group: {
          _id: {
            categoryId: '$categoryId',
            gender: '$gender',
            clothingSize: '$clothingSize',
            reviewStatus: '$reviewStatus',
            paymentStatus: '$paymentStatus',
            isPickupVerified: '$isPickupVerified',
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const categoryMap = new Map();
    for (const cat of categories) {
      categoryMap.set(cat._id.toString(), {
        id: cat._id,
        name: cat.name,
        code: cat.code,
        capacity: cat.capacity,
      });
    }

    const result: Record<string, any> = {};
    for (const s of stats) {
      const catId = s._id.categoryId.toString();
      if (!result[catId]) {
        const cat = categoryMap.get(catId);
        result[catId] = {
          ...cat,
          byGender: {},
          bySize: {},
          byReviewStatus: {},
          byPaymentStatus: {},
          pickupVerified: 0,
          total: 0,
        };
      }
      result[catId].total += s.count;
      result[catId].byGender[s._id.gender] = (result[catId].byGender[s._id.gender] || 0) + s.count;
      result[catId].bySize[s._id.clothingSize] = (result[catId].bySize[s._id.clothingSize] || 0) + s.count;
      result[catId].byReviewStatus[s._id.reviewStatus] = (result[catId].byReviewStatus[s._id.reviewStatus] || 0) + s.count;
      result[catId].byPaymentStatus[s._id.paymentStatus] = (result[catId].byPaymentStatus[s._id.paymentStatus] || 0) + s.count;
      if (s._id.isPickupVerified) {
        result[catId].pickupVerified += s.count;
      }
    }

    return Object.values(result);
  }
}

export const registrationService = new RegistrationService();
