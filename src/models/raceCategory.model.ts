import mongoose, { Schema, Document, Model } from 'mongoose';
import { CategoryType, Gender, ClothingSize } from '../types/enums';

export interface ICategoryAgeLimit {
  min?: number;
  max?: number;
}

export interface ICategoryPrice {
  earlyBird: number;
  regular: number;
  late?: number;
}

export interface ICategoryPrize {
  position: number;
  amount: number;
  description?: string;
}

export interface IRaceCategory extends Document {
  raceId: Schema.Types.ObjectId;
  name: string;
  code: string;
  type: CategoryType;
  distanceKm: number;
  description?: string;
  routeDescription?: string;
  startTime?: string;
  capacity: number;
  registered: number;
  maleCapacity?: number;
  femaleCapacity?: number;
  maleRegistered?: number;
  femaleRegistered?: number;
  waitlistCapacity?: number;
  waitlistRegistered?: number;
  price: ICategoryPrice;
  earlyBirdEndDate?: Date;
  allowedGenders?: Gender[];
  ageLimit?: ICategoryAgeLimit;
  allowedSizes: ClothingSize[];
  requireProof: boolean;
  minCompletionTime?: number;
  cutOffTime?: string;
  prizes?: ICategoryPrize[];
  bibPrefix: string;
  nextBibSequence: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  isFull(): boolean;
  isGenderFull(gender: Gender): boolean;
  getCurrentPrice(): number;
  incrementRegistered(gender?: Gender): Promise<boolean>;
  decrementRegistered(gender?: Gender): Promise<void>;
  generateBib(gender?: Gender): string;
}

const CategoryPriceSchema = new Schema<ICategoryPrice>(
  {
    earlyBird: { type: Number, required: true, min: 0 },
    regular: { type: Number, required: true, min: 0 },
    late: { type: Number, min: 0 },
  },
  { _id: false }
);

const CategoryAgeLimitSchema = new Schema<ICategoryAgeLimit>(
  {
    min: { type: Number, min: 0 },
    max: { type: Number, min: 0 },
  },
  { _id: false }
);

const CategoryPrizeSchema = new Schema<ICategoryPrize>(
  {
    position: { type: Number, required: true, min: 1 },
    amount: { type: Number, required: true, min: 0 },
    description: String,
  },
  { _id: false }
);

const RaceCategorySchema: Schema<IRaceCategory> = new Schema(
  {
    raceId: {
      type: Schema.Types.ObjectId,
      ref: 'Race',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, '组别名称不能为空'],
      trim: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    type: {
      type: String,
      enum: Object.values(CategoryType),
      required: true,
      index: true,
    },
    distanceKm: {
      type: Number,
      required: [true, '距离不能为空'],
      min: [0, '距离不能为负数'],
    },
    description: String,
    routeDescription: String,
    startTime: String,
    capacity: {
      type: Number,
      required: [true, '组别容量不能为空'],
      min: [1, '组别容量必须大于0'],
    },
    registered: {
      type: Number,
      default: 0,
      min: 0,
    },
    maleCapacity: {
      type: Number,
      min: 0,
    },
    femaleCapacity: {
      type: Number,
      min: 0,
    },
    maleRegistered: {
      type: Number,
      default: 0,
      min: 0,
    },
    femaleRegistered: {
      type: Number,
      default: 0,
      min: 0,
    },
    waitlistCapacity: {
      type: Number,
      min: 0,
    },
    waitlistRegistered: {
      type: Number,
      default: 0,
      min: 0,
    },
    price: {
      type: CategoryPriceSchema,
      required: true,
    },
    earlyBirdEndDate: Date,
    allowedGenders: [
      {
        type: String,
        enum: Object.values(Gender),
      },
    ],
    ageLimit: CategoryAgeLimitSchema,
    allowedSizes: [
      {
        type: String,
        enum: Object.values(ClothingSize),
      },
    ],
    requireProof: {
      type: Boolean,
      default: false,
    },
    minCompletionTime: {
      type: Number,
      min: 0,
    },
    cutOffTime: String,
    prizes: [CategoryPrizeSchema],
    bibPrefix: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    nextBibSequence: {
      type: Number,
      default: 1,
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

RaceCategorySchema.index({ raceId: 1, code: 1 }, { unique: true });
RaceCategorySchema.index({ raceId: 1, isActive: 1, sortOrder: 1 });

RaceCategorySchema.methods.isFull = function (): boolean {
  return this.registered >= this.capacity;
};

RaceCategorySchema.methods.isGenderFull = function (gender: Gender): boolean {
  if (gender === Gender.MALE && this.maleCapacity) {
    return (this.maleRegistered || 0) >= this.maleCapacity;
  }
  if (gender === Gender.FEMALE && this.femaleCapacity) {
    return (this.femaleRegistered || 0) >= this.femaleCapacity;
  }
  return this.isFull();
};

RaceCategorySchema.methods.getCurrentPrice = function (): number {
  const now = new Date();
  if (this.earlyBirdEndDate && now <= this.earlyBirdEndDate) {
    return this.price.earlyBird;
  }
  return this.price.regular;
};

RaceCategorySchema.methods.incrementRegistered = async function (gender?: Gender): Promise<boolean> {
  if (this.isFull()) {
    return false;
  }
  if (gender && this.isGenderFull(gender as Gender)) {
    return false;
  }

  this.registered += 1;
  if (gender === Gender.MALE && this.maleCapacity !== undefined) {
    this.maleRegistered = (this.maleRegistered || 0) + 1;
  }
  if (gender === Gender.FEMALE && this.femaleCapacity !== undefined) {
    this.femaleRegistered = (this.femaleRegistered || 0) + 1;
  }
  await this.save();
  return true;
};

RaceCategorySchema.methods.decrementRegistered = async function (gender?: Gender): Promise<void> {
  if (this.registered > 0) {
    this.registered -= 1;
  }
  if (gender === Gender.MALE && this.maleRegistered && this.maleRegistered > 0) {
    this.maleRegistered -= 1;
  }
  if (gender === Gender.FEMALE && this.femaleRegistered && this.femaleRegistered > 0) {
    this.femaleRegistered -= 1;
  }
  await this.save();
};

RaceCategorySchema.methods.generateBib = function (gender?: Gender): string {
  const sequence = this.nextBibSequence;
  this.nextBibSequence += 1;
  const genderPrefix = gender === Gender.MALE ? 'M' : gender === Gender.FEMALE ? 'F' : '';
  return `${this.bibPrefix}${genderPrefix}${String(sequence).padStart(5, '0')}`;
};

export const RaceCategory: Model<IRaceCategory> = mongoose.model<IRaceCategory>('RaceCategory', RaceCategorySchema);
