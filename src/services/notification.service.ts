import mongoose from 'mongoose';
import { Notification, INotification } from '../models/notification.model';
import { Registration } from '../models/registration.model';
import { NotificationType, NotificationTemplate } from '../types/enums';
import { PaginatedResult, PaginationParams } from '../types';
import { getPaginationInfo } from '../utils/response';
import { generateUUID } from '../utils/crypto';
import { config } from '../config';
import logger from '../utils/logger';

export interface SendNotificationDto {
  raceId?: string;
  registrationId?: string;
  userId?: string;
  type: NotificationType;
  template: NotificationTemplate;
  recipient: {
    userId?: string;
    phone?: string;
    email?: string;
  };
  variables?: Record<string, any>;
  scheduledAt?: Date;
  sentBy?: string;
}

const TEMPLATE_CONFIG: Record<NotificationTemplate, { title: string; content: string }> = {
  [NotificationTemplate.REGISTRATION_SUCCESS]: {
    title: '报名成功通知',
    content:
      '尊敬的{realName}，您已成功报名{raceName}（{categoryName}），报名编号：{registrationNo}。请及时完成缴费，缴费截止时间：{paymentDeadline}。',
  },
  [NotificationTemplate.REVIEW_APPROVED]: {
    title: '审核通过通知',
    content:
      '尊敬的{realName}，恭喜您！您的{raceName}报名资料已审核通过，参赛号：{bibNumber}。请按时领取参赛物品。',
  },
  [NotificationTemplate.REVIEW_REJECTED]: {
    title: '审核结果通知',
    content:
      '尊敬的{realName}，很抱歉，您的{raceName}报名资料未通过审核，原因：{comment}。如有疑问请联系赛事组委会。',
  },
  [NotificationTemplate.PAYMENT_SUCCESS]: {
    title: '缴费成功通知',
    content:
      '尊敬的{realName}，您的{raceName}报名费已缴纳成功，金额：¥{amount}。请耐心等待审核结果。',
  },
  [NotificationTemplate.PAYMENT_REMINDER]: {
    title: '缴费提醒',
    content:
      '尊敬的{realName}，您的{raceName}报名尚未缴费，截止时间：{deadline}。请及时完成支付，逾期将取消报名资格。',
  },
  [NotificationTemplate.REFUND_PROCESSED]: {
    title: '退款处理完成',
    content:
      '尊敬的{realName}，您的{raceName}退款申请已处理完成，退款金额：¥{amount}，预计1-7个工作日到账。',
  },
  [NotificationTemplate.RACE_REMINDER]: {
    title: '赛事提醒',
    content:
      '尊敬的{realName}，{raceName}将于{raceDate}在{location}开赛，参赛号：{bibNumber}。请准时参加，祝您取得好成绩！',
  },
  [NotificationTemplate.BIB_ASSIGNED]: {
    title: '参赛号分配通知',
    content:
      '尊敬的{realName}，您的{raceName}参赛号已分配：{bibNumber}。请登录官网查看详情并下载领物二维码。',
  },
  [NotificationTemplate.PICKUP_REMINDER]: {
    title: '领物提醒',
    content:
      '尊敬的{realName}，{raceName}参赛物品领取时间：{pickupTime}，地点：{pickupLocation}。请携带身份证件和领物二维码。',
  },
  [NotificationTemplate.RESULT_PUBLISHED]: {
    title: '成绩发布通知',
    content:
      '尊敬的{realName}，{raceName}成绩已发布，您的完赛时间：{finishTime}，排名：{rank}。登录官网查看完整成绩证书。',
  },
};

export class NotificationService {
  private renderTemplate(
    template: NotificationTemplate,
    variables: Record<string, any>
  ): { title: string; content: string } {
    const cfg = TEMPLATE_CONFIG[template] || { title: template, content: '' };
    let content = cfg.content;
    let title = cfg.title;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      const replacement = String(value ?? '');
      content = content.split(placeholder).join(replacement);
      title = title.split(placeholder).join(replacement);
    }

    return { title, content };
  }

  private async sendSms(phone: string, content: string): Promise<boolean> {
    if (!config.sms.apiKey) {
      logger.info(`[SMS模拟] 发送到 ${phone}: ${content.substring(0, 80)}`);
      return true;
    }
    try {
      logger.info(`[SMS] 发送短信到 ${phone}: ${content.substring(0, 50)}...`);
      return true;
    } catch (error) {
      logger.error('发送短信失败:', error);
      return false;
    }
  }

  private async sendEmail(email: string, title: string, content: string): Promise<boolean> {
    try {
      logger.info(`[Email模拟] 发送到 ${email}: 标题[${title}] 内容[${content.substring(0, 50)}...]`);
      return true;
    } catch (error) {
      logger.error('发送邮件失败:', error);
      return false;
    }
  }

  async sendNotification(data: SendNotificationDto): Promise<INotification> {
    let variables = data.variables || {};

    if (data.registrationId && Object.keys(variables).length === 0) {
      const registration = await Registration.findById(data.registrationId)
        .populate('raceId', 'name code raceDate location paymentDeadline pickupStartTime pickupEndTime')
        .populate('categoryId', 'name');

      if (registration) {
        const race = registration.raceId as any;
        const category = registration.categoryId as any;
        variables = {
          realName: registration.realName,
          raceName: race?.name || '',
          categoryName: category?.name || '',
          registrationNo: registration.registrationNo,
          bibNumber: registration.bibNumber || '待分配',
          paymentDeadline: registration.paymentDueDate.toLocaleString('zh-CN'),
          amount: registration.price,
          deadline: registration.paymentDueDate.toLocaleString('zh-CN'),
          raceDate: race?.raceDate ? new Date(race.raceDate).toLocaleDateString('zh-CN') : '',
          location: race?.location?.address || '',
          pickupTime: race?.pickupStartTime
            ? `${new Date(race.pickupStartTime).toLocaleDateString('zh-CN')} - ${new Date(race.pickupEndTime || race.pickupStartTime).toLocaleDateString('zh-CN')}`
            : '',
          pickupLocation: race?.location?.address || '',
          comment: registration.reviewComment || '',
        };
      }
    }

    const { title, content } = this.renderTemplate(data.template, variables);

    const notification = new Notification({
      notificationId: generateUUID(),
      raceId: data.raceId ? new mongoose.Types.ObjectId(data.raceId) : undefined,
      registrationId: data.registrationId ? new mongoose.Types.ObjectId(data.registrationId) : undefined,
      userId: data.userId ? new mongoose.Types.ObjectId(data.userId) : undefined,
      type: data.type,
      template: data.template,
      title,
      content,
      variables,
      recipient: {
        userId: data.recipient.userId ? new mongoose.Types.ObjectId(data.recipient.userId) : undefined,
        phone: data.recipient.phone,
        email: data.recipient.email,
      },
      sendStatus: data.scheduledAt ? 'pending' : 'sending',
      scheduledAt: data.scheduledAt,
      sentBy: data.sentBy ? new mongoose.Types.ObjectId(data.sentBy) : undefined,
    });

    await notification.save();

    if (!data.scheduledAt) {
      await this.dispatchNotification(notification);
    }

    return notification;
  }

  private async dispatchNotification(notification: INotification): Promise<void> {
    return new Promise(async (resolve) => {
      try {
        let sent = false;
        switch (notification.type) {
          case NotificationType.SMS:
            if (notification.recipient.phone) {
              sent = await this.sendSms(notification.recipient.phone, notification.content);
            }
            break;
          case NotificationType.EMAIL:
            if (notification.recipient.email) {
              sent = await this.sendEmail(notification.recipient.email, notification.title, notification.content);
            }
            break;
          case NotificationType.IN_APP:
          case NotificationType.PUSH:
            sent = true;
            break;
        }

        if (sent) {
          await notification.markSent();
        } else {
          await notification.markFailed('发送渠道未配置或失败');
        }
      } catch (error: any) {
        await notification.markFailed(error.message || '未知错误');
      }
      resolve();
    });
  }

  async retryNotification(notificationId: string): Promise<INotification> {
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      throw new Error('通知记录不存在');
    }
    if (notification.sendStatus === 'sent') {
      return notification;
    }
    notification.sendStatus = 'sending';
    notification.retryCount += 1;
    await notification.save();
    await this.dispatchNotification(notification);
    return notification;
  }

  async markAsRead(notificationId: string, userId: string): Promise<INotification | null> {
    const notification = await Notification.findById(notificationId);
    if (!notification) return null;
    if (notification.userId && notification.userId?.toString() !== userId) {
      throw new Error('无权标记此通知');
    }
    await notification.markRead();
    return notification;
  }

  async getUserNotifications(
    userId: string,
    params: PaginationParams & { isRead?: boolean; type?: NotificationType }
  ): Promise<PaginatedResult<INotification>> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;

    const filter: Record<string, any> = {
      $or: [{ userId }, { 'recipient.userId': userId }],
    };
    if (params.isRead !== undefined) filter.isRead = params.isRead;
    if (params.type) filter.type = params.type;

    const [total, notifications] = await Promise.all([
      Notification.countDocuments(filter),
      Notification.find(filter)
        .populate('raceId', 'name code')
        .populate('registrationId', 'registrationNo realName')
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    return {
      data: notifications as any as INotification[],
      pagination: getPaginationInfo(page, pageSize, total),
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return Notification.countDocuments({
      $or: [{ userId }, { 'recipient.userId': userId }],
      isRead: false,
    });
  }

  async batchSendByRace(
    raceId: string,
    template: NotificationTemplate,
    type: NotificationType = NotificationType.SMS,
    filters?: {
      categoryId?: string;
      reviewStatus?: string;
      paymentStatus?: string;
    },
    sentBy?: string
  ): Promise<{ total: number; queued: number; skipped: number }> {
    const regFilter: Record<string, any> = { raceId, isCancelled: false };
    if (filters?.categoryId) regFilter.categoryId = filters.categoryId;
    if (filters?.reviewStatus) regFilter.reviewStatus = filters.reviewStatus;
    if (filters?.paymentStatus) regFilter.paymentStatus = filters.paymentStatus;

    const registrations = await Registration.find(regFilter);
    let queued = 0;
    let skipped = 0;

    for (const reg of registrations) {
      try {
        await this.sendNotification({
          raceId,
          registrationId: reg._id.toString(),
          userId: reg.userId?.toString(),
          type,
          template,
          recipient: {
            userId: reg.userId?.toString(),
            phone: reg.phone,
            email: reg.email,
          },
          sentBy,
        });
        queued++;
      } catch {
        skipped++;
      }
    }

    logger.info(`批量发送通知: 赛事${raceId} - 共${registrations.length}人，成功${queued}，跳过${skipped}`);
    return { total: registrations.length, queued, skipped };
  }

  async getNotifications(
    params: PaginationParams & {
      raceId?: string;
      type?: NotificationType;
      template?: NotificationTemplate;
      sendStatus?: string;
      keyword?: string;
    }
  ): Promise<PaginatedResult<INotification>> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 50;

    const filter: Record<string, any> = {};
    if (params.raceId) filter.raceId = params.raceId;
    if (params.type) filter.type = params.type;
    if (params.template) filter.template = params.template;
    if (params.sendStatus) filter.sendStatus = params.sendStatus;
    if (params.keyword) {
      filter.$or = [
        { title: { $regex: params.keyword, $options: 'i' } },
        { content: { $regex: params.keyword, $options: 'i' } },
      ];
    }

    const [total, notifications] = await Promise.all([
      Notification.countDocuments(filter),
      Notification.find(filter)
        .populate('raceId', 'name code')
        .populate('userId', 'username realName')
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    return {
      data: notifications as any as INotification[],
      pagination: getPaginationInfo(page, pageSize, total),
    };
  }
}

export const notificationService = new NotificationService();
