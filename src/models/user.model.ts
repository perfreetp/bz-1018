import mongoose, { Schema, Document, Model } from 'mongoose';
import { Role } from '../types/enums';

export interface IUser extends Document {
  username: string;
  email?: string;
  phone: string;
  passwordHash: string;
  realName?: string;
  avatar?: string;
  role: Role;
  isActive: boolean;
  lastLoginAt?: Date;
  lastLoginIp?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
}

const UserSchema: Schema<IUser> = new Schema(
  {
    username: {
      type: String,
      required: [true, '用户名不能为空'],
      unique: true,
      trim: true,
      minlength: [3, '用户名长度不能少于3个字符'],
      maxlength: [50, '用户名长度不能超过50个字符'],
      index: true,
    },
    email: {
      type: String,
      sparse: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, '邮箱格式不正确'],
    },
    phone: {
      type: String,
      required: [true, '手机号不能为空'],
      unique: true,
      trim: true,
      match: [/^1[3-9]\d{9}$/, '手机号格式不正确'],
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, '密码不能为空'],
      select: false,
    },
    realName: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: Object.values(Role),
      default: Role.USER,
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastLoginAt: Date,
    lastLoginIp: String,
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

UserSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.compare(password, this.passwordHash);
};

UserSchema.index({ role: 1, isActive: 1 });

export const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);
