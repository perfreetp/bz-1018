import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import { config } from '../config';
import { JwtPayload } from '../types';

export function generateToken(payload: JwtPayload): string {
  return (jwt.sign as any)(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as any,
  });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, config.jwt.secret) as JwtPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string, saltRounds: number = 10): Promise<string> {
  return bcrypt.hash(password, saltRounds);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateUUID(): string {
  return uuidv4();
}

export function generateBibNumber(
  raceId: string,
  categoryCode: string,
  sequence: number,
  gender?: string
): string {
  const raceSuffix = raceId.slice(-3).toUpperCase();
  const genderPrefix = gender ? (gender === 'male' ? 'M' : gender === 'female' ? 'F' : 'O') : '';
  const seqStr = String(sequence).padStart(5, '0');
  return `${categoryCode}${genderPrefix}${raceSuffix}${seqStr}`;
}

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function generateQRCodeData(data: string): Promise<string> {
  try {
    return await (QRCode.toDataURL as any)(data, {
      width: 300,
      margin: 2,
      quality: 1,
    });
  } catch (error) {
    throw new Error('生成二维码失败');
  }
}

export function generatePickupToken(registrationId: string): string {
  const payload = `${registrationId}:${Date.now()}`;
  return Buffer.from(payload).toString('base64url');
}

export function parsePickupToken(token: string): { registrationId: string; timestamp: number } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const [registrationId, timestampStr] = decoded.split(':');
    return {
      registrationId,
      timestamp: parseInt(timestampStr, 10),
    };
  } catch {
    return null;
  }
}

export function generateOrderNo(prefix: string = 'MR'): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${dateStr}${timeStr}${random}`;
}
