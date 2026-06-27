import { createApp } from '@/app';
import { env } from '@/config/env';
import { logger } from '@/utils/logger';

const main = async (): Promise<void> => {
  const { server } = createApp();

  server.listen(env.GATEWAY_PORT, () => {
    logger.info({ port: env.GATEWAY_PORT }, 'API Gateway is running');
    logger.info({
      routes: {
        '/api/auth': env.AUTH_SERVICE_URL,
        '/api/users': env.USER_SERVICE_URL,
        '/api/conversations': env.CHAT_SERVICE_URL,
        '/api/media': env.MULTIMEDIA_SERVICE_URL,
        '/api/notifications': env.NOTIFICATION_SERVICE_URL,
        '/events': env.REALTIME_SERVICE_URL,
      },
    }, 'Registered proxy routes');
  });

  const shutdown = (): void => {
    logger.info('Shutting down gateway...');
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

void main();
