import mongoose, { Schema, Document, Model } from 'mongoose';
import { ReviewStatus, PaymentStatus } from '../types/enums';

export interface ITeamMember {
  registrationId: Schema.Types.ObjectId;
  isCaptain: boolean;
  joinedAt: Date;
}

export interface ITeam extends Document {
  teamNo: string;
  name: string;
  raceId: Schema.Types.ObjectId;
  categoryId: Schema.Types.ObjectId;
  captainId: Schema.Types.ObjectId;
  captainRegistrationId: Schema.Types.ObjectId;
  description?: string;
  slogan?: string;
  logoUrl?: string;
  members: ITeamMember[];
  memberCount: number;
  maxMembers: number;
  minMembers: number;
  isComplete: boolean;
  reviewStatus: ReviewStatus;
  reviewComment?: string;
  reviewedBy?: Schema.Types.ObjectId;
  reviewedAt?: Date;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  paidAmount?: number;
  paidAt?: Date;
  note?: string;
  isCancelled: boolean;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
  addMember(registrationId: Schema.Types.ObjectId): Promise<boolean>;
  removeMember(registrationId: Schema.Types.ObjectId): Promise<void>;
  setCaptain(registrationId: Schema.Types.ObjectId): Promise<void>;
  checkComplete(): boolean;
}

const TeamMemberSchema = new Schema<ITeamMember>(
  {
    registrationId: {
      type: Schema.Types.ObjectId,
      ref: 'Registration',
      required: true,
    },
    isCaptain: {
      type: Boolean,
      default: false,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const TeamSchema: Schema<ITeam> = new Schema(
  {
    teamNo: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, '团队名称不能为空'],
      trim: true,
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
    captainId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    captainRegistrationId: {
      type: Schema.Types.ObjectId,
      ref: 'Registration',
      required: true,
      index: true,
    },
    description: String,
    slogan: String,
    logoUrl: String,
    members: [TeamMemberSchema],
    memberCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    maxMembers: {
      type: Number,
      required: true,
      min: 2,
    },
    minMembers: {
      type: Number,
      required: true,
      min: 2,
    },
    isComplete: {
      type: Boolean,
      default: false,
      index: true,
    },
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
    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.UNPAID,
      required: true,
      index: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAmount: {
      type: Number,
      min: 0,
    },
    paidAt: Date,
    note: String,
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

TeamSchema.index({ raceId: 1, name: 1 }, { unique: true });

TeamSchema.methods.addMember = async function (registrationId: Schema.Types.ObjectId): Promise<boolean> {
  if (this.memberCount >= this.maxMembers) {
    return false;
  }
  if (this.members.some((m: ITeamMember) => m.registrationId?.toString() === registrationId.toString())) {
    return false;
  }
  this.members.push({
    registrationId,
    isCaptain: false,
    joinedAt: new Date(),
  });
  this.memberCount = this.members.length;
  this.isComplete = this.checkComplete();
  await this.save();
  return true;
};

TeamSchema.methods.removeMember = async function (registrationId: Schema.Types.ObjectId): Promise<void> {
  const member = this.members.find((m: ITeamMember) => m.registrationId?.toString() === registrationId.toString());
  if (member && !member.isCaptain) {
    this.members = this.members.filter((m: ITeamMember) => m.registrationId?.toString() !== registrationId.toString());
    this.memberCount = this.members.length;
    this.isComplete = this.checkComplete();
    await this.save();
  }
};

TeamSchema.methods.setCaptain = async function (registrationId: Schema.Types.ObjectId): Promise<void> {
  this.members.forEach((m: ITeamMember) => {
    m.isCaptain = m.registrationId?.toString() === registrationId.toString();
  });
  await this.save();
};

TeamSchema.methods.checkComplete = function (): boolean {
  return this.memberCount >= this.minMembers;
};

export const Team: Model<ITeam> = mongoose.model<ITeam>('Team', TeamSchema);
