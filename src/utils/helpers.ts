import { Types } from 'mongoose';

export function objectIdEquals(a: any, b: any): boolean {
  if (!a || !b) return false;
  const aStr = typeof a === 'string' ? a : a.toString?.();
  const bStr = typeof b === 'string' ? b : b.toString?.();
  return aStr === bStr;
}

export function toObjectId(id: string): any {
  return new Types.ObjectId(id) as any;
}

export function castArray<T>(arr: any[]): T[] {
  return arr as unknown as T[];
}

export function cast<T>(val: any): T {
  return val as unknown as T;
}
