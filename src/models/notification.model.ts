import mongoose, { Schema, Document, Model } from 'mongoose';
import { NotificationType, NotificationTemplate } from '../types/enums';

export interface INotificationRecipient {
  userId?: Schema.Types.ObjectId;
  phone?: string;
  email?: string;
}

export interface INotification extends Document {
  notificationId: string;
  raceId?: Schema.Types.ObjectId;
  registrationId?: Schema.Types.ObjectId;
  userId?: Schema.Types.ObjectId;
  type: NotificationType;
  template: NotificationTemplate;
  title: string;
  content: string;
  variables?: Record<string, any>;
  recipient: INotificationRecipient;
  sendStatus: 'pending' | 'sending' | 'sent' | 'failed';
  sentAt?: Date;
  errorMessage?: string;
  retryCount: number;
  gatewayResponse?: Record<string, any>;
  readAt?: Date;
  isRead: boolean;
  scheduledAt?: Date;
  sentBy?: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  markSent(gatewayResponse?: Record<string, any>): Promise<void>;
  markFailed(errorMessage: string, gatewayResponse?: Record<string, any>): Promise<void>;
  markRead(): Promise<void>;
}

const NotificationRecipientSchema = new Schema<INotificationRecipient>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
  },
  { _id: false }
);

const NotificationSchema: Schema<INotification> = new Schema(
  {
    notificationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    raceId: {
      type: Schema.Types.ObjectId,
      ref: 'Race',
      index: true,
    },
    registrationId: {
      type: Schema.Types.ObjectId,
      ref: 'Registration',
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
      index: true,
    },
    template: {
      type: String,
      enum: Object.values(NotificationTemplate),
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    variables: Schema.Types.Mixed,
    recipient: {
      type: NotificationRecipientSchema,
      required: true,
    },
    sendStatus: {
      type: String,
      enum: ['pending', 'sending', 'sent', 'failed'],
      default: 'pending',
      required: true,
      index: true,
    },
    sentAt: Date,
    errorMessage: String,
    retryCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    gatewayResponse: Schema.Types.Mixed,
    readAt: Date,
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    scheduledAt: Date,
    sentBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

NotificationSchema.index({ type: 1, sendStatus: 1, createdAt: -1 });

NotificationSchema.methods.markSent = async function (gatewayResponse?: Record<string, any>): Promise<void> {
  this.sendStatus = 'sent';
  this.sentAt = new Date();
  if (gatewayResponse) this.gatewayResponse = gatewayResponse;
  await this.save();
};

NotificationSchema.methods.markFailed = async function (
  errorMessage: string,
  gatewayResponse?: Record<string, any>
): Promise<void> {
  this.sendStatus = 'failed';
  this.errorMessage = errorMessage;
  this.retryCount += 1;
  if (gatewayResponse) this.gatewayResponse = gatewayResponse;
  await this.save();
};

NotificationSchema.methods.markRead = async function (): Promise<void> {
  this.isRead = true;
  this.readAt = new Date();
  await this.save();
};

export const Notification: Model<INotification> = mongoose.model<INotification>('Notification', NotificationSchema);
