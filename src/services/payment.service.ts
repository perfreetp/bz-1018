import mongoose from 'mongoose';
import { Payment, IPayment } from '../models/payment.model';
import { RefundRequest, IRefundRequest } from '../models/refund.model';
import { Registration, IRegistration } from '../models/registration.model';
import { Team, ITeam } from '../models/team.model';
import { Race } from '../models/race.model';
import { RaceCategory } from '../models/raceCategory.model';
import { PaymentStatus, PaymentMethod } from '../types/enums';
import { PaginatedResult, PaginationParams } from '../types';
import { getPaginationInfo } from '../utils/response';
import { generateOrderNo } from '../utils/crypto';
import logger from '../utils/logger';

export interface CreatePaymentDto {
  raceId: string;
  registrationId?: string;
  teamId?: string;
  userId?: string;
  paymentMethod?: PaymentMethod;
  discount?: number;
  couponCode?: string;
  description: string;
  callbackUrl?: string;
  notifyUrl?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreateRefundRequestDto {
  paymentId: string;
  userId: string;
  reason: string;
  detailedReason?: string;
  requestedAmount?: number;
  files?: { name: string; url: string }[];
  bankAccount?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    branchName?: string;
  };
}

export class PaymentService {
  private async calculatePrice(
    raceId: string,
    registrationId?: string,
    teamId?: string
  ): Promise<{ amount: number; finalAmount: number; description: string }> {
    if (teamId) {
      const team = await Team.findById(teamId);
      if (!team) {
        throw new Error('团队不存在');
      }
      const category = await RaceCategory.findById(team.categoryId);
      if (!category) {
        throw new Error('组别不存在');
      }
      const unitPrice = category.getCurrentPrice();
      const total = unitPrice * team.memberCount;
      return {
        amount: total,
        finalAmount: total,
        description: `${team.name} 团队报名费 (${team.memberCount}人)`,
      };
    }

    if (registrationId) {
      const registration = await Registration.findById(registrationId);
      if (!registration) {
        throw new Error('报名记录不存在');
      }
      return {
        amount: registration.price,
        finalAmount: registration.price,
        description: `${registration.realName} 报名费`,
      };
    }

    throw new Error('必须指定报名记录或团队');
  }

  async createPayment(data: CreatePaymentDto): Promise<IPayment> {
    const race = await Race.findById(data.raceId);
    if (!race) {
      throw new Error('赛事不存在');
    }

    if (data.registrationId) {
      const reg = await Registration.findById(data.registrationId);
      if (!reg) throw new Error('报名记录不存在');
      if (reg.paymentStatus === PaymentStatus.PAID) throw new Error('该报名已缴费');
      if (reg.isCancelled) throw new Error('该报名已取消');
    }

    if (data.teamId) {
      const team = await Team.findById(data.teamId);
      if (!team) throw new Error('团队不存在');
      if (team.paymentStatus === PaymentStatus.PAID) throw new Error('该团队已缴费');
      if (team.isCancelled) throw new Error('该团队已取消');
    }

    const priceInfo = await this.calculatePrice(
      data.raceId,
      data.registrationId,
      data.teamId
    );

    const discount = data.discount || 0;
    if (discount > priceInfo.amount) {
      throw new Error('折扣金额不能大于应付金额');
    }

    const orderNo = generateOrderNo('MR');
    const refundDeadline = new Date(race.raceDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const payment = new Payment({
      orderNo,
      raceId: data.raceId,
      registrationId: data.registrationId ? new mongoose.Types.ObjectId(data.registrationId) : undefined,
      teamId: data.teamId ? new mongoose.Types.ObjectId(data.teamId) : undefined,
      userId: data.userId ? new mongoose.Types.ObjectId(data.userId) : undefined,
      amount: priceInfo.amount,
      discount,
      couponCode: data.couponCode,
      finalAmount: priceInfo.finalAmount - discount,
      paymentMethod: data.paymentMethod,
      status: PaymentStatus.PENDING,
      description: data.description || priceInfo.description,
      expiryTime: new Date(Date.now() + 30 * 60 * 1000),
      currency: 'CNY',
      callbackUrl: data.callbackUrl,
      notifyUrl: data.notifyUrl,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      isRefundable: new Date() < refundDeadline,
      refundDeadline,
    });

    await payment.save();

    if (data.registrationId) {
      await Registration.findByIdAndUpdate(data.registrationId, {
        paymentStatus: PaymentStatus.PENDING,
      });
    }

    if (data.teamId) {
      await Team.findByIdAndUpdate(data.teamId, {
        paymentStatus: PaymentStatus.PENDING,
        totalAmount: priceInfo.finalAmount,
      });
    }

    logger.info(`创建支付订单: ${orderNo} - 金额: ${payment.finalAmount}`);
    return payment;
  }

  async getPaymentByOrderNo(orderNo: string): Promise<IPayment | null> {
    return Payment.findOne({ orderNo })
      .populate('raceId', 'name code')
      .populate('registrationId', 'registrationNo realName phone bibNumber')
      .populate('teamId', 'teamNo name memberCount');
  }

  async getPaymentById(id: string): Promise<IPayment | null> {
    return Payment.findById(id)
      .populate('raceId', 'name code')
      .populate('registrationId', 'registrationNo realName phone bibNumber');
  }

  async confirmPayment(
    orderNo: string,
    transactionId: string,
    paidAmount: number,
    paymentMethod?: PaymentMethod,
    gatewayResponse?: Record<string, any>
  ): Promise<IPayment> {
    const payment = await Payment.findOne({ orderNo });
    if (!payment) {
      throw new Error('支付订单不存在');
    }
    if (payment.status === PaymentStatus.PAID) {
      throw new Error('该订单已支付');
    }

    await payment.markAsPaid(transactionId, paidAmount, gatewayResponse);
    if (paymentMethod) {
      payment.paymentMethod = paymentMethod;
      await payment.save();
    }

    if (payment.registrationId) {
      await Registration.findByIdAndUpdate(payment.registrationId, {
        paymentStatus: PaymentStatus.PAID,
        paidAmount,
        paidAt: new Date(),
      });
    }

    if (payment.teamId) {
      const team = await Team.findById(payment.teamId);
      await Team.findByIdAndUpdate(payment.teamId, {
        paymentStatus: PaymentStatus.PAID,
        paidAmount,
        paidAt: new Date(),
      });

      await Registration.updateMany(
        { teamId: payment.teamId },
        { paymentStatus: PaymentStatus.PAID, paidAmount: paidAmount / (team?.memberCount || 1), paidAt: new Date() }
      );
    }

    logger.info(`支付成功: ${orderNo} - 交易号: ${transactionId} - 金额: ${paidAmount}`);
    return payment;
  }

  async failPayment(orderNo: string, gatewayResponse?: Record<string, any>): Promise<IPayment> {
    const payment = await Payment.findOne({ orderNo });
    if (!payment) {
      throw new Error('支付订单不存在');
    }
    await payment.markAsFailed(gatewayResponse);

    if (payment.registrationId) {
      await Registration.findByIdAndUpdate(payment.registrationId, {
        paymentStatus: PaymentStatus.UNPAID,
      });
    }
    if (payment.teamId) {
      await Team.findByIdAndUpdate(payment.teamId, {
        paymentStatus: PaymentStatus.UNPAID,
      });
    }

    logger.warn(`支付失败: ${orderNo}`);
    return payment;
  }

  async getUserPayments(
    userId: string,
    params: PaginationParams & { status?: PaymentStatus }
  ): Promise<PaginatedResult<IPayment>> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;

    const filter: Record<string, any> = { userId };
    if (params.status) filter.status = params.status;

    const [total, payments] = await Promise.all([
      Payment.countDocuments(filter),
      Payment.find(filter)
        .populate('raceId', 'name code')
        .populate('registrationId', 'registrationNo realName')
        .populate('teamId', 'teamNo name')
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    return {
      data: payments as any as IPayment[],
      pagination: getPaginationInfo(page, pageSize, total),
    };
  }

  async getRacePayments(
    raceId: string,
    params: PaginationParams & {
      status?: PaymentStatus;
      method?: PaymentMethod;
      keyword?: string;
    }
  ): Promise<PaginatedResult<IPayment>> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 50;

    const filter: Record<string, any> = { raceId };
    if (params.status) filter.status = params.status;
    if (params.method) filter.paymentMethod = params.method;

    const [total, payments] = await Promise.all([
      Payment.countDocuments(filter),
      Payment.find(filter)
        .populate('registrationId', 'registrationNo realName phone')
        .populate('userId', 'username phone')
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    return {
      data: payments as any as IPayment[],
      pagination: getPaginationInfo(page, pageSize, total),
    };
  }

  async createRefundRequest(data: CreateRefundRequestDto): Promise<IRefundRequest> {
    const payment = await Payment.findById(data.paymentId);
    if (!payment) {
      throw new Error('支付订单不存在');
    }
    if (payment.status !== PaymentStatus.PAID) {
      throw new Error('只有已支付的订单才能申请退款');
    }
    if (!payment.isRefundable) {
      throw new Error('该订单已过退款截止时间，无法退款');
    }

    const existingRequest = await RefundRequest.findOne({
      paymentId: data.paymentId,
      status: { $in: [PaymentStatus.REFUND_PENDING, PaymentStatus.PENDING] },
    });
    if (existingRequest) {
      throw new Error('已有进行中的退款申请');
    }

    const race = await Race.findById(payment.raceId);
    const daysUntilRace = race ? Math.ceil((race.raceDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

    let refundRate = 0;
    if (daysUntilRace >= 30) refundRate = 100;
    else if (daysUntilRace >= 15) refundRate = 80;
    else if (daysUntilRace >= 7) refundRate = 50;
    else if (daysUntilRace >= 3) refundRate = 30;
    else refundRate = 0;

    const originalAmount = payment.paidAmount || payment.finalAmount;
    const requestedAmount = data.requestedAmount || originalAmount;
    const approvedAmount = Math.floor((originalAmount * refundRate) / 100);

    if (requestedAmount > originalAmount) {
      throw new Error('申请退款金额不能大于实付金额');
    }

    const requestNo = generateOrderNo('RF');

    const refundRequest = new RefundRequest({
      requestNo,
      paymentId: payment._id,
      raceId: payment.raceId,
      registrationId: payment.registrationId,
      teamId: payment.teamId,
      userId: new mongoose.Types.ObjectId(data.userId),
      originalAmount,
      requestedAmount,
      approvedAmount: Math.min(approvedAmount, requestedAmount),
      refundRate,
      reason: data.reason,
      detailedReason: data.detailedReason,
      files: data.files,
      status: PaymentStatus.REFUND_PENDING,
      bankAccount: data.bankAccount,
      isExpedited: refundRate === 100,
    });

    await refundRequest.save();

    await Payment.findByIdAndUpdate(data.paymentId, {
      status: PaymentStatus.REFUND_PENDING,
    });

    logger.info(`创建退款申请: ${requestNo} - 实付: ${originalAmount} - 建议退款: ${approvedAmount} (${refundRate}%)`);
    return refundRequest;
  }

  async approveRefund(
    refundId: string,
    adminId: string,
    approvedAmount: number,
    comment?: string
  ): Promise<IRefundRequest> {
    const refund = await RefundRequest.findById(refundId);
    if (!refund) {
      throw new Error('退款申请不存在');
    }
    if (refund.status !== PaymentStatus.REFUND_PENDING) {
      throw new Error('该退款申请当前状态不允许审批');
    }
    if (approvedAmount > refund.originalAmount) {
      throw new Error('退款金额不能大于原支付金额');
    }

    refund.approve(new mongoose.Types.ObjectId(adminId) as any, approvedAmount, comment);

    logger.info(`审批退款: ${refund.requestNo} - 金额: ${approvedAmount}`);
    return refund;
  }

  async rejectRefund(refundId: string, adminId: string, comment: string): Promise<IRefundRequest> {
    const refund = await RefundRequest.findById(refundId);
    if (!refund) {
      throw new Error('退款申请不存在');
    }

    refund.reject(new mongoose.Types.ObjectId(adminId) as any, comment);

    await Payment.findByIdAndUpdate(refund.paymentId, {
      status: PaymentStatus.PAID,
    });

    logger.info(`驳回退款: ${refund.requestNo} - 原因: ${comment}`);
    return refund;
  }

  async processRefund(
    refundId: string,
    transactionId?: string,
    gatewayResponse?: Record<string, any>
  ): Promise<IRefundRequest> {
    const refund = await RefundRequest.findById(refundId);
    if (!refund) {
      throw new Error('退款申请不存在');
    }
    if (refund.status !== PaymentStatus.REFUND_PENDING || refund.approvedAmount === undefined) {
      throw new Error('该退款申请未通过审批，无法执行退款');
    }

    refund.markProcessed(transactionId, gatewayResponse);

    const payment = await Payment.findById(refund.paymentId);
    if (payment) {
      await payment.processRefund(
        refund.approvedAmount || 0,
        refund.reason,
        transactionId,
        gatewayResponse
      );
    }

    if (refund.registrationId) {
      await Registration.findByIdAndUpdate(refund.registrationId, {
        paymentStatus: PaymentStatus.REFUNDED,
      });
    }

    logger.info(`退款完成: ${refund.requestNo} - 金额: ${refund.approvedAmount}`);
    return refund;
  }

  async getRefundRequests(
    params: PaginationParams & {
      raceId?: string;
      status?: PaymentStatus;
      userId?: string;
    }
  ): Promise<PaginatedResult<IRefundRequest>> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;

    const filter: Record<string, any> = {};
    if (params.raceId) filter.raceId = params.raceId;
    if (params.status) filter.status = params.status;
    if (params.userId) filter.userId = params.userId;

    const [total, requests] = await Promise.all([
      RefundRequest.countDocuments(filter),
      RefundRequest.find(filter)
        .populate('raceId', 'name code')
        .populate('registrationId', 'registrationNo realName phone')
        .populate('userId', 'username realName phone')
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    return {
      data: requests as any as IRefundRequest[],
      pagination: getPaginationInfo(page, pageSize, total),
    };
  }
}

export const paymentService = new PaymentService();
