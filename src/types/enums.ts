export enum RaceStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  REGISTRATION_OPEN = 'registration_open',
  REGISTRATION_CLOSED = 'registration_closed',
  REVIEWING = 'reviewing',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum CategoryType {
  FULL_MARATHON = 'full_marathon',
  HALF_MARATHON = 'half_marathon',
  TEN_K = '10k',
  FIVE_K = '5k',
  FUN_RUN = 'fun_run',
  MINI_MARATHON = 'mini_marathon',
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export enum ClothingSize {
  XS = 'XS',
  S = 'S',
  M = 'M',
  L = 'L',
  XL = 'XL',
  XXL = 'XXL',
  XXXL = 'XXXL',
}

export enum IDType {
  ID_CARD = 'id_card',
  PASSPORT = 'passport',
  HK_MACAU = 'hk_macau',
  TAIWAN = 'taiwan',
  MILITARY = 'military',
}

export enum RegistrationType {
  INDIVIDUAL = 'individual',
  TEAM = 'team',
}

export enum ReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SUPPLEMENT_REQUIRED = 'supplement_required',
}

export enum PaymentStatus {
  UNPAID = 'unpaid',
  PENDING = 'pending',
  PAID = 'paid',
  REFUND_PENDING = 'refund_pending',
  REFUNDED = 'refunded',
  REFUND_FAILED = 'refund_failed',
  FAILED = 'failed',
}

export enum PaymentMethod {
  WECHAT = 'wechat',
  ALIPAY = 'alipay',
  UNIONPAY = 'unionpay',
  BANK_TRANSFER = 'bank_transfer',
  CREDIT_CARD = 'credit_card',
}

export enum NotificationType {
  SMS = 'sms',
  EMAIL = 'email',
  PUSH = 'push',
  IN_APP = 'in_app',
}

export enum NotificationTemplate {
  REGISTRATION_SUCCESS = 'registration_success',
  REVIEW_APPROVED = 'review_approved',
  REVIEW_REJECTED = 'review_rejected',
  PAYMENT_SUCCESS = 'payment_success',
  PAYMENT_REMINDER = 'payment_reminder',
  REFUND_PROCESSED = 'refund_processed',
  RACE_REMINDER = 'race_reminder',
  BIB_ASSIGNED = 'bib_assigned',
  PICKUP_REMINDER = 'pickup_reminder',
  RESULT_PUBLISHED = 'result_published',
}

export enum VerificationStatus {
  NOT_VERIFIED = 'not_verified',
  PENDING = 'pending',
  VERIFIED = 'verified',
  ALREADY_VERIFIED = 'already_verified',
  INVALID = 'invalid',
}

export enum Role {
  ADMIN = 'admin',
  ORGANIZER = 'organizer',
  VOLUNTEER = 'volunteer',
  CHECKER = 'checker',
  USER = 'user',
}
