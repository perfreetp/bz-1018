import mongoose, { Schema, Document, Model } from 'mongoose';
import { RaceStatus } from '../types/enums';

export interface IRaceLocation {
  city: string;
  district?: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

export interface IRace extends Document {
  name: string;
  code: string;
  edition: string;
  tagline?: string;
  description?: string;
  rules?: string;
  awards?: string;
  status: RaceStatus;
  raceDate: Date;
  registrationStartTime: Date;
  registrationEndTime: Date;
  reviewStartTime?: Date;
  reviewEndTime?: Date;
  paymentDeadline: Date;
  pickupStartTime?: Date;
  pickupEndTime?: Date;
  location: IRaceLocation;
  organizer: string;
  organizerContact: string;
  organizerEmail?: string;
  coverImage?: string;
  bannerImage?: string;
  images?: string[];
  isTeamRegistrationAllowed: boolean;
  maxTeamSize?: number;
  minTeamSize?: number;
  requireProofDocument: boolean;
  requireMedicalCertificate: boolean;
  isPublished: boolean;
  tags?: string[];
  totalCapacity: number;
  totalRegistered: number;
  sortOrder: number;
  createdBy: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  isRegistrationOpen(): boolean;
  isPaymentOverdue(): boolean;
  daysUntilRace(): number;
}

const RaceLocationSchema = new Schema<IRaceLocation>(
  {
    city: { type: String, required: true, trim: true },
    district: { type: String, trim: true },
    address: { type: String, required: true, trim: true },
    latitude: Number,
    longitude: Number,
  },
  { _id: false }
);

const RaceSchema: Schema<IRace> = new Schema(
  {
    name: {
      type: String,
      required: [true, '赛事名称不能为空'],
      trim: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    edition: {
      type: String,
      required: true,
      trim: true,
    },
    tagline: String,
    description: String,
    rules: String,
    awards: String,
    status: {
      type: String,
      enum: Object.values(RaceStatus),
      default: RaceStatus.DRAFT,
      index: true,
      required: true,
    },
    raceDate: {
      type: Date,
      required: [true, '比赛日期不能为空'],
      index: true,
    },
    registrationStartTime: {
      type: Date,
      required: [true, '报名开始时间不能为空'],
    },
    registrationEndTime: {
      type: Date,
      required: [true, '报名结束时间不能为空'],
    },
    reviewStartTime: Date,
    reviewEndTime: Date,
    paymentDeadline: {
      type: Date,
      required: [true, '付款截止时间不能为空'],
    },
    pickupStartTime: Date,
    pickupEndTime: Date,
    location: {
      type: RaceLocationSchema,
      required: true,
    },
    organizer: {
      type: String,
      required: [true, '主办方不能为空'],
      trim: true,
    },
    organizerContact: {
      type: String,
      required: [true, '主办方联系电话不能为空'],
      trim: true,
    },
    organizerEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    coverImage: String,
    bannerImage: String,
    images: [String],
    isTeamRegistrationAllowed: {
      type: Boolean,
      default: false,
    },
    maxTeamSize: {
      type: Number,
      min: 2,
      default: 10,
    },
    minTeamSize: {
      type: Number,
      min: 2,
      default: 3,
    },
    requireProofDocument: {
      type: Boolean,
      default: false,
    },
    requireMedicalCertificate: {
      type: Boolean,
      default: false,
    },
    isPublished: {
      type: Boolean,
      default: false,
      index: true,
    },
    tags: [String],
    totalCapacity: {
      type: Number,
      required: [true, '赛事总容量不能为空'],
      min: [1, '赛事总容量必须大于0'],
    },
    totalRegistered: {
      type: Number,
      default: 0,
      min: 0,
    },
    sortOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

RaceSchema.methods.isRegistrationOpen = function (): boolean {
  const now = new Date();
  return (
    this.status === RaceStatus.REGISTRATION_OPEN &&
    now >= this.registrationStartTime &&
    now <= this.registrationEndTime
  );
};

RaceSchema.methods.isPaymentOverdue = function (): boolean {
  return new Date() > this.paymentDeadline;
};

RaceSchema.methods.daysUntilRace = function (): number {
  const diff = this.raceDate.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

RaceSchema.index({ status: 1, isPublished: 1, raceDate: -1 });
RaceSchema.index({ registrationStartTime: 1, registrationEndTime: 1 });

export const Race: Model<IRace> = mongoose.model<IRace>('Race', RaceSchema);
