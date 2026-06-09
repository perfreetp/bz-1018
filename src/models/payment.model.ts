import mongoose, { Schema, Document, Model } from 'mongoose';
import { PaymentStatus, PaymentMethod } from '../types/enums';

export interface IPayment extends Document {
  orderNo: string;
  raceId: Schema.Types.ObjectId;
  registrationId?: Schema.Types.ObjectId;
  teamId?: Schema.Types.ObjectId;
  userId?: Schema.Types.ObjectId;
  amount: number;
  discount?: number;
  couponCode?: string;
  finalAmount: number;
  paidAmount?: number;
  paymentMethod?: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string;
  gatewayResponse?: Record<string, any>;
  paymentTime?: Date;
  expiryTime?: Date;
  refundAmount?: number;
  refundTime?: Date;
  refundTransactionId?: string;
  refundReason?: string;
  refundGatewayResponse?: Record<string, any>;
  currency: string;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  callbackUrl?: string;
  notifyUrl?: string;
  isRefundable: boolean;
  refundDeadline?: Date;
  createdBy?: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  markAsPaid(transactionId: string, paidAmount: number, gatewayResponse?: Record<string, any>): Promise<void>;
  markAsFailed(gatewayResponse?: Record<string, any>): Promise<void>;
  processRefund(refundAmount: number, reason: string, transactionId?: string, gatewayResponse?: Record<string, any>): Promise<void>;
}

const PaymentSchema: Schema<IPayment> = new Schema(
  {
    orderNo: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    raceId: {
      type: Schema.Types.ObjectId,
      ref: 'Race',
      required: true,
      index: true,
    },
    registrationId: {
      type: Schema.Types.ObjectId,
      ref: 'Registration',
      index: true,
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    couponCode: String,
    finalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAmount: {
      type: Number,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethod),
    },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.UNPAID,
      required: true,
      index: true,
    },
    transactionId: {
      type: String,
      sparse: true,
      index: true,
    },
    gatewayResponse: Schema.Types.Mixed,
    paymentTime: Date,
    expiryTime: Date,
    refundAmount: {
      type: Number,
      min: 0,
    },
    refundTime: Date,
    refundTransactionId: String,
    refundReason: String,
    refundGatewayResponse: Schema.Types.Mixed,
    currency: {
      type: String,
      required: true,
      default: 'CNY',
    },
    description: {
      type: String,
      required: true,
    },
    ipAddress: String,
    userAgent: String,
    callbackUrl: String,
    notifyUrl: String,
    isRefundable: {
      type: Boolean,
      default: true,
    },
    refundDeadline: Date,
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

PaymentSchema.index({ raceId: 1, status: 1 });
PaymentSchema.index({ createdAt: -1 });

PaymentSchema.methods.markAsPaid = async function (
  transactionId: string,
  paidAmount: number,
  gatewayResponse?: Record<string, any>
): Promise<void> {
  this.status = PaymentStatus.PAID;
  this.transactionId = transactionId;
  this.paidAmount = paidAmount;
  this.paymentTime = new Date();
  if (gatewayResponse) this.gatewayResponse = gatewayResponse;
  await this.save();
};

PaymentSchema.methods.markAsFailed = async function (gatewayResponse?: Record<string, any>): Promise<void> {
  this.status = PaymentStatus.FAILED;
  if (gatewayResponse) this.gatewayResponse = gatewayResponse;
  await this.save();
};

PaymentSchema.methods.processRefund = async function (
  refundAmount: number,
  reason: string,
  transactionId?: string,
  gatewayResponse?: Record<string, any>
): Promise<void> {
  this.status = PaymentStatus.REFUNDED;
  this.refundAmount = refundAmount;
  this.refundReason = reason;
  this.refundTime = new Date();
  if (transactionId) this.refundTransactionId = transactionId;
  if (gatewayResponse) this.refundGatewayResponse = gatewayResponse;
  await this.save();
};

export const Payment: Model<IPayment> = mongoose.model<IPayment>('Payment', PaymentSchema);
