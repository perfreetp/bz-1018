import mongoose, { Schema, Document, Model } from 'mongoose';
import { Gender, IDType, ClothingSize, RegistrationType, ReviewStatus, PaymentStatus } from '../types/enums';

export interface IEmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

export interface IIdDocument {
  type: IDType;
  number: string;
  issueDate?: Date;
  expiryDate?: Date;
}

export interface IResultProof {
  raceName: string;
  raceDate: Date;
  completionTime: string;
  certificateUrl?: string;
  distanceKm: number;
}

export interface IMedicalCertificate {
  certificateUrl: string;
  issueDate: Date;
  expiryDate?: Date;
  hospital: string;
  doctorName?: string;
}

export interface IRegistration extends Document {
  registrationNo: string;
  userId?: Schema.Types.ObjectId;
  raceId: Schema.Types.ObjectId;
  categoryId: Schema.Types.ObjectId;
  registrationType: RegistrationType;
  teamId?: Schema.Types.ObjectId;
  bibNumber?: string;
  bibAssignedAt?: Date;
  realName: string;
  gender: Gender;
  birthDate: Date;
  age: number;
  idDocument: IIdDocument;
  nationality: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  province?: string;
  zipCode?: string;
  occupation?: string;
  company?: string;
  emergencyContact: IEmergencyContact;
  clothingSize: ClothingSize;
  resultProof?: IResultProof[];
  medicalCertificate?: IMedicalCertificate;
  photoUrl?: string;
  reviewStatus: ReviewStatus;
  reviewComment?: string;
  reviewedBy?: Schema.Types.ObjectId;
  reviewedAt?: Date;
  isLocked: boolean;
  lockedAt?: Date;
  lockedBy?: Schema.Types.ObjectId;
  paymentStatus: PaymentStatus;
  paidAmount?: number;
  paidAt?: Date;
  paymentDueDate: Date;
  price: number;
  qrCode?: string;
  pickupToken?: string;
  isPickupVerified: boolean;
  pickupVerifiedAt?: Date;
  pickupVerifiedBy?: Schema.Types.ObjectId;
  pickupLocation?: string;
  waiverSigned: boolean;
  waiverSignedAt?: Date;
  note?: string;
  source: 'website' | 'volunteer' | 'offline';
  registeredBy?: Schema.Types.ObjectId;
  isCancelled: boolean;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
  canEdit(): boolean;
  approve(adminId: Schema.Types.ObjectId, comment?: string): Promise<void>;
  reject(adminId: Schema.Types.ObjectId, comment: string): Promise<void>;
  lock(userId: Schema.Types.ObjectId): Promise<void>;
  markPickupVerified(userId: Schema.Types.ObjectId, location?: string): Promise<void>;
}

const EmergencyContactSchema = new Schema<IEmergencyContact>(
  {
    name: { type: String, required: true, trim: true },
    relationship: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
  },
  { _id: false }
);

const IdDocumentSchema = new Schema<IIdDocument>(
  {
    type: {
      type: String,
      enum: Object.values(IDType),
      required: true,
    },
    number: { type: String, required: true, trim: true, index: true },
    issueDate: Date,
    expiryDate: Date,
  },
  { _id: false }
);

const ResultProofSchema = new Schema<IResultProof>(
  {
    raceName: { type: String, required: true, trim: true },
    raceDate: { type: Date, required: true },
    completionTime: { type: String, required: true },
    certificateUrl: String,
    distanceKm: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const MedicalCertificateSchema = new Schema<IMedicalCertificate>(
  {
    certificateUrl: { type: String, required: true },
    issueDate: { type: Date, required: true },
    expiryDate: Date,
    hospital: { type: String, required: true, trim: true },
    doctorName: String,
  },
  { _id: false }
);

const RegistrationSchema: Schema<IRegistration> = new Schema(
  {
    registrationNo: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    raceId: {
      type: Schema.Types.ObjectId,
      ref: 'Race',
      required: true,
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'RaceCategory',
      required: true,
      index: true,
    },
    registrationType: {
      type: String,
      enum: Object.values(RegistrationType),
      required: true,
      default: RegistrationType.INDIVIDUAL,
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      index: true,
    },
    bibNumber: {
      type: String,
      sparse: true,
      index: true,
    },
    bibAssignedAt: Date,
    realName: {
      type: String,
      required: [true, '真实姓名不能为空'],
      trim: true,
    },
    gender: {
      type: String,
      enum: Object.values(Gender),
      required: true,
      index: true,
    },
    birthDate: {
      type: Date,
      required: [true, '出生日期不能为空'],
    },
    age: {
      type: Number,
      required: true,
      min: 0,
      max: 150,
    },
    idDocument: {
      type: IdDocumentSchema,
      required: true,
    },
    nationality: {
      type: String,
      required: true,
      default: '中国',
      trim: true,
    },
    phone: {
      type: String,
      required: [true, '联系电话不能为空'],
      trim: true,
      index: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    address: String,
    city: String,
    province: String,
    zipCode: String,
    occupation: String,
    company: String,
    emergencyContact: {
      type: EmergencyContactSchema,
      required: true,
    },
    clothingSize: {
      type: String,
      enum: Object.values(ClothingSize),
      required: true,
    },
    resultProof: [ResultProofSchema],
    medicalCertificate: MedicalCertificateSchema,
    photoUrl: String,
    reviewStatus: {
      type: String,
      enum: Object.values(ReviewStatus),
      default: ReviewStatus.PENDING,
      required: true,
      index: true,
    },
    reviewComment: String,
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: Date,
    isLocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    lockedAt: Date,
    lockedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.UNPAID,
      required: true,
      index: true,
    },
    paidAmount: {
      type: Number,
      min: 0,
    },
    paidAt: Date,
    paymentDueDate: {
      type: Date,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    qrCode: String,
    pickupToken: String,
    isPickupVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    pickupVerifiedAt: Date,
    pickupVerifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    pickupLocation: String,
    waiverSigned: {
      type: Boolean,
      required: true,
      default: false,
    },
    waiverSignedAt: Date,
    note: String,
    source: {
      type: String,
      enum: ['website', 'volunteer', 'offline'],
      default: 'website',
    },
    registeredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    isCancelled: {
      type: Boolean,
      default: false,
      index: true,
    },
    cancelledAt: Date,
    cancellationReason: String,
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

RegistrationSchema.index({ raceId: 1, categoryId: 1 });
RegistrationSchema.index({ raceId: 1, reviewStatus: 1 });
RegistrationSchema.index({ raceId: 1, paymentStatus: 1 });
RegistrationSchema.index({ raceId: 1, 'idDocument.number': 1 }, { unique: true, sparse: true });

RegistrationSchema.methods.canEdit = function (): boolean {
  return !this.isLocked && this.reviewStatus !== ReviewStatus.APPROVED && !this.isCancelled;
};

RegistrationSchema.methods.approve = async function (adminId: Schema.Types.ObjectId, comment?: string): Promise<void> {
  this.reviewStatus = ReviewStatus.APPROVED;
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  if (comment) this.reviewComment = comment;
  await this.save();
};

RegistrationSchema.methods.reject = async function (adminId: Schema.Types.ObjectId, comment: string): Promise<void> {
  this.reviewStatus = ReviewStatus.REJECTED;
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  this.reviewComment = comment;
  await this.save();
};

RegistrationSchema.methods.lock = async function (userId: Schema.Types.ObjectId): Promise<void> {
  this.isLocked = true;
  this.lockedAt = new Date();
  this.lockedBy = userId;
  await this.save();
};

RegistrationSchema.methods.markPickupVerified = async function (userId: Schema.Types.ObjectId, location?: string): Promise<void> {
  this.isPickupVerified = true;
  this.pickupVerifiedAt = new Date();
  this.pickupVerifiedBy = userId;
  if (location) this.pickupLocation = location;
  await this.save();
};

export const Registration: Model<IRegistration> = mongoose.model<IRegistration>('Registration', RegistrationSchema);
