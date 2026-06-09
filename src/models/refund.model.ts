import mongoose, { Schema, Document, Model } from 'mongoose';
import { PaymentStatus } from '../types/enums';

export interface IRefundFile {
  name: string;
  url: string;
  uploadedAt: Date;
}

export interface IRefundRequest extends Document {
  requestNo: string;
  paymentId: Schema.Types.ObjectId;
  raceId: Schema.Types.ObjectId;
  registrationId?: Schema.Types.ObjectId;
  teamId?: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  originalAmount: number;
  requestedAmount: number;
  approvedAmount?: number;
  refundRate?: number;
  reason: string;
  detailedReason?: string;
  files?: IRefundFile[];
  status: PaymentStatus;
  reviewComment?: string;
  reviewedBy?: Schema.Types.ObjectId;
  reviewedAt?: Date;
  processedAt?: Date;
  transactionId?: string;
  gatewayResponse?: Record<string, any>;
  bankAccount?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    branchName?: string;
  };
  isExpedited: boolean;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  approve(adminId: Schema.Types.ObjectId, approvedAmount: number, comment?: string): Promise<void>;
  reject(adminId: Schema.Types.ObjectId, comment: string): Promise<void>;
  markProcessed(transactionId?: string, gatewayResponse?: Record<string, any>): Promise<void>;
}

const RefundFileSchema = new Schema<IRefundFile>(
  {
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const BankAccountSchema = new Schema(
  {
    bankName: { type: String, required: true, trim: true },
    accountName: { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true, trim: true },
    branchName: String,
  },
  { _id: false }
);

const RefundRequestSchema: Schema<IRefundRequest> = new Schema(
  {
    requestNo: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
      required: true,
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
      required: true,
      index: true,
    },
    originalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    requestedAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    approvedAmount: {
      type: Number,
      min: 0,
    },
    refundRate: {
      type: Number,
      min: 0,
      max: 100,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    detailedReason: String,
    files: [RefundFileSchema],
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.REFUND_PENDING,
      required: true,
      index: true,
    },
    reviewComment: String,
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: Date,
    processedAt: Date,
    transactionId: String,
    gatewayResponse: Schema.Types.Mixed,
    bankAccount: BankAccountSchema,
    isExpedited: {
      type: Boolean,
      default: false,
    },
    expiresAt: Date,
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

RefundRequestSchema.index({ status: 1, createdAt: -1 });

RefundRequestSchema.methods.approve = async function (
  adminId: Schema.Types.ObjectId,
  approvedAmount: number,
  comment?: string
): Promise<void> {
  this.status = PaymentStatus.REFUND_PENDING;
  this.approvedAmount = approvedAmount;
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  if (comment) this.reviewComment = comment;
  await this.save();
};

RefundRequestSchema.methods.reject = async function (
  adminId: Schema.Types.ObjectId,
  comment: string
): Promise<void> {
  this.status = PaymentStatus.REFUND_FAILED;
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  this.reviewComment = comment;
  await this.save();
};

RefundRequestSchema.methods.markProcessed = async function (
  transactionId?: string,
  gatewayResponse?: Record<string, any>
): Promise<void> {
  this.status = PaymentStatus.REFUNDED;
  this.processedAt = new Date();
  if (transactionId) this.transactionId = transactionId;
  if (gatewayResponse) this.gatewayResponse = gatewayResponse;
  await this.save();
};

export const RefundRequest: Model<IRefundRequest> = mongoose.model<IRefundRequest>('RefundRequest', RefundRequestSchema);
