import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authMiddleware } from '@/middleware/auth.middleware';
import { errorHandler } from '@/middleware/error-handler';
import { globalRateLimit } from '@/middleware/rate-limit.middleware';
import { requestLogger } from '@/middleware/request-logger.middleware';
import { registerProxies } from '@/proxy/proxy';

export const createApp = (): Application => {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: '*', credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(requestLogger);
  app.use(globalRateLimit);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'gateway' });
  });

  // JWT validation before proxying (public paths are exempted inside the middleware)
  app.use(authMiddleware);

  // Proxy routes to downstream services
  registerProxies(app);

  app.use((_req, res) => {
    res.status(404).json({ message: 'Not Found' });
  });

  app.use(errorHandler);

  return app;
};
