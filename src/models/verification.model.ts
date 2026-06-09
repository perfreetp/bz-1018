import mongoose, { Schema, Document, Model } from 'mongoose';
import { VerificationStatus } from '../types/enums';

export interface IVerificationLog extends Document {
  verificationId: string;
  raceId: Schema.Types.ObjectId;
  registrationId: Schema.Types.ObjectId;
  categoryId: Schema.Types.ObjectId;
  bibNumber?: string;
  realName: string;
  verificationType: 'pickup' | 'entry' | 'onsite';
  status: VerificationStatus;
  qrCode?: string;
  pickupToken?: string;
  itemsPicked?: {
    name: string;
    quantity: number;
    size?: string;
  }[];
  verifierId?: Schema.Types.ObjectId;
  verifierName?: string;
  station: string;
  deviceId?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  ipAddress?: string;
  notes?: string;
  previousStatus?: VerificationStatus;
  previousVerificationId?: string;
  verifiedAt: Date;
  createdAt: Date;
}

const ItemPickedSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    size: String,
  },
  { _id: false }
);

const VerificationLogSchema: Schema<IVerificationLog> = new Schema(
  {
    verificationId: {
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
      required: true,
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'RaceCategory',
      required: true,
    },
    bibNumber: {
      type: String,
      index: true,
    },
    realName: {
      type: String,
      required: true,
      trim: true,
    },
    verificationType: {
      type: String,
      enum: ['pickup', 'entry', 'onsite'],
      required: true,
      default: 'pickup',
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(VerificationStatus),
      required: true,
      index: true,
    },
    qrCode: String,
    pickupToken: String,
    itemsPicked: [ItemPickedSchema],
    verifierId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    verifierName: {
      type: String,
      trim: true,
    },
    station: {
      type: String,
      required: true,
      trim: true,
    },
    deviceId: String,
    location: String,
    latitude: Number,
    longitude: Number,
    ipAddress: String,
    notes: String,
    previousStatus: {
      type: String,
      enum: Object.values(VerificationStatus),
    },
    previousVerificationId: String,
    verifiedAt: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

VerificationLogSchema.index({ raceId: 1, verificationType: 1, verifiedAt: -1 });
VerificationLogSchema.index({ registrationId: 1, verificationType: 1 }, { unique: true, sparse: true });

export const VerificationLog: Model<IVerificationLog> = mongoose.model<IVerificationLog>('VerificationLog', VerificationLogSchema);
