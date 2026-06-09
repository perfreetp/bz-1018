import { User, IUser } from '../models/user.model';
import { Role } from '../types/enums';
import { generateToken, hashPassword, comparePassword } from '../utils/crypto';
import { PaginatedResult, PaginationParams } from '../types';
import { getPaginationInfo } from '../utils/response';
import logger from '../utils/logger';
import { validatePhone, validateEmail } from '../utils/validators';

export interface RegisterUserDto {
  username: string;
  email?: string;
  phone: string;
  password: string;
  realName?: string;
  role?: Role;
}

export interface LoginDto {
  account: string;
  password: string;
  ip?: string;
}

export class AuthService {
  async register(data: RegisterUserDto): Promise<{ user: IUser; token: string }> {
    if (!validatePhone(data.phone)) {
      throw new Error('手机号格式不正确');
    }
    if (data.email && !validateEmail(data.email)) {
      throw new Error('邮箱格式不正确');
    }
    if (data.username.length < 3) {
      throw new Error('用户名长度至少3个字符');
    }
    if (data.password.length < 6) {
      throw new Error('密码长度至少6位');
    }

    const existingPhone = await User.findOne({ phone: data.phone });
    if (existingPhone) {
      throw new Error('该手机号已注册');
    }

    const existingUser = await User.findOne({ username: data.username });
    if (existingUser) {
      throw new Error('用户名已存在');
    }

    if (data.email) {
      const existingEmail = await User.findOne({ email: data.email });
      if (existingEmail) {
        throw new Error('该邮箱已注册');
      }
    }

    const passwordHash = await hashPassword(data.password);
    const user = new User({
      username: data.username,
      email: data.email,
      phone: data.phone,
      passwordHash,
      realName: data.realName,
      role: data.role || Role.USER,
    });

    await user.save();

    const token = generateToken({
      userId: user._id.toString(), role: user.role, email: user.email, phone: user.phone });

    logger.info(`用户注册成功: ${user.username} (${user._id})`);

    user.passwordHash = '' as any;
    return { user, token };
  }

  async login(data: LoginDto): Promise<{ user: IUser; token: string }> {
    let user: IUser | null = null;

    if (validatePhone(data.account)) {
      user = await User.findOne({ phone: data.account }).select('+passwordHash');
    } else {
      user = await User.findOne({ username: data.account }).select('+passwordHash');
    }

    if (!user) {
      throw new Error('账号或密码错误');
    }
    if (!user.isActive) {
      throw new Error('账号已被禁用');
    }

    const valid = await comparePassword(data.password, user.passwordHash);
    if (!valid) {
      throw new Error('账号或密码错误');
    }

    user.lastLoginAt = new Date();
    if (data.ip) user.lastLoginIp = data.ip;
    await user.save();

    const token = generateToken({
      userId: user._id.toString(), role: user.role, email: user.email, phone: user.phone });

    logger.info(`用户登录: ${user.username}`);

    user.passwordHash = '' as any;
    return { user, token };
  }

  async getCurrentUser(userId: string): Promise<IUser | null> {
    return User.findById(userId);
  }

  async updateProfile(userId: string, data: { realName?: string; avatar?: string; email?: string; phone?: string }): Promise<IUser | null> {
    if (data.phone && !validatePhone(data.phone)) {
      throw new Error('手机号格式不正确');
    }
    if (data.email && !validateEmail(data.email)) {
      throw new Error('邮箱格式不正确');
    }
    return User.findByIdAndUpdate(userId, { $set: data }, { new: true, runValidators: true });
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<boolean> {
    const user = await User.findById(userId).select('+passwordHash');
    if (!user) return false;
    const valid = await comparePassword(oldPassword, user.passwordHash);
    if (!valid) throw new Error('原密码不正确');
    if (newPassword.length < 6) throw new Error('新密码长度至少6位');
    user.passwordHash = await hashPassword(newPassword);
    await user.save();
    return true;
  }

  async getAllUsers(params: PaginationParams & { role?: Role; isActive?: boolean; keyword?: string }): Promise<PaginatedResult<IUser>> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 50;
    const filter: Record<string, any> = {};
    if (params.role) filter.role = params.role;
    if (params.isActive !== undefined) filter.isActive = params.isActive;
    if (params.keyword) {
      filter.$or = [
        { username: { $regex: params.keyword, $options: 'i' } },
        { realName: { $regex: params.keyword, $options: 'i' } },
        { phone: { $regex: params.keyword } },
      ];
    }

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    return {
      data: users as any as IUser[],
      pagination: getPaginationInfo(page, pageSize, total),
    };
  }

  async toggleUserStatus(userId: string, isActive: boolean, operatorId: string): Promise<IUser | null> {
    const user = await User.findByIdAndUpdate(userId, { isActive }, { new: true });
    if (user) {
      logger.info(`${isActive ? '启用' : '禁用'}用户: ${user.username} - 操作人: ${operatorId}`);
    }
    return user;
  }

  async assignRole(userId: string, role: Role, operatorId: string): Promise<IUser | null> {
    const user = await User.findByIdAndUpdate(userId, { role }, { new: true });
    if (user) {
      logger.info(`分配角色: ${user.username} -> ${role} - 操作人: ${operatorId}`);
    }
    return user;
  }
}

export const authService = new AuthService();
