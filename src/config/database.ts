import mongoose from 'mongoose';
import { config } from '../config';
import logger from '../utils/logger';

export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(config.mongodb.uri);
    logger.info('✅ MongoDB 数据库连接成功');

    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB 连接错误:', error);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB 连接已断开');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB 重新连接成功');
    });
  } catch (error) {
    logger.error('❌ MongoDB 数据库连接失败:', error);
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB 数据库已断开连接');
  } catch (error) {
    logger.error('断开 MongoDB 连接失败:', error);
  }
}
