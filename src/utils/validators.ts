import { IdCardValidationResult } from '../types';

const PROVINCE_CODES: Record<string, string> = {
  '11': '北京', '12': '天津', '13': '河北', '14': '山西', '15': '内蒙古',
  '21': '辽宁', '22': '吉林', '23': '黑龙江', '31': '上海', '32': '江苏',
  '33': '浙江', '34': '安徽', '35': '福建', '36': '江西', '37': '山东',
  '41': '河南', '42': '湖北', '43': '湖南', '44': '广东', '45': '广西',
  '46': '海南', '50': '重庆', '51': '四川', '52': '贵州', '53': '云南',
  '54': '西藏', '61': '陕西', '62': '甘肃', '63': '青海', '64': '宁夏',
  '65': '新疆', '71': '台湾', '81': '香港', '82': '澳门', '91': '海外',
};

const WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const CHECK_CODES = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];

export function validateIdCard(idNumber: string): IdCardValidationResult {
  if (!idNumber) {
    return { valid: false, message: '身份证号不能为空' };
  }

  const id = idNumber.trim().toUpperCase();

  if (!/^\d{17}[\dX]$/.test(id)) {
    return { valid: false, message: '身份证号格式不正确，应为18位数字或末位为X' };
  }

  const provinceCode = id.substring(0, 2);
  if (!PROVINCE_CODES[provinceCode]) {
    return { valid: false, message: '身份证号前两位地区码无效' };
  }

  const year = parseInt(id.substring(6, 10), 10);
  const month = parseInt(id.substring(10, 12), 10);
  const day = parseInt(id.substring(12, 14), 10);

  const birthDate = new Date(year, month - 1, day);
  if (
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() !== month - 1 ||
    birthDate.getDate() !== day
  ) {
    return { valid: false, message: '身份证号出生日期无效' };
  }

  const now = new Date();
  if (birthDate > now) {
    return { valid: false, message: '身份证号出生日期不能晚于当前日期' };
  }

  const age = now.getFullYear() - year - 
    (now.getMonth() < month - 1 || (now.getMonth() === month - 1 && now.getDate() < day) ? 1 : 0);

  if (age < 0 || age > 150) {
    return { valid: false, message: '身份证号年龄不在有效范围内' };
  }

  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += parseInt(id.charAt(i), 10) * WEIGHTS[i];
  }
  const checkCode = CHECK_CODES[sum % 11];
  if (checkCode !== id.charAt(17)) {
    return { valid: false, message: '身份证号校验位不正确' };
  }

  const genderDigit = parseInt(id.charAt(16), 10);
  const gender = genderDigit % 2 === 1 ? 'male' : 'female';

  return {
    valid: true,
    parsedData: {
      provinceCode,
      birthDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      gender,
      age,
    },
  };
}

export function validatePhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassport(passport: string): boolean {
  return /^(G|D|S|P|H|M|E)\d{8}$/.test(passport.trim().toUpperCase());
}
