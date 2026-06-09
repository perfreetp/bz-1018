import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { connectDatabase } from './config/database';
import { apiLimiter, notFoundHandler, errorHandler } from './middleware/error.middleware';
import routes from './routes';
import logger from './utils/logger';

const app = express();

app.use(helmet());

app.use(cors({
  origin: config.nodeEnv === 'production'
    ? (origin, callback) => callback(null, true)
    : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev', {
  stream: {
    write: (message) => logger.info(message.trim()),
  },
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api', apiLimiter);

app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

const startServer = async (): Promise<void> => {
  try {
    await connectDatabase();

    app.listen(config.port, () => {
      logger.info('');
      logger.info('========================================');
      logger.info('  马拉松报名后端服务已启动');
      logger.info(`  环境: ${config.nodeEnv}`);
      logger.info(`  端口: ${config.port}`);
      logger.info(`  API 根路径: http://localhost:${config.port}/api/v1`);
      logger.info(`  健康检查: http://localhost:${config.port}/api/v1/health`);
      logger.info('========================================');
      logger.info('');
    });
  } catch (error) {
    logger.error('启动服务失败:', error);
    process.exit(1);
  }
};

export default app;
export { startServer };
