import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer, type Server } from 'http';
import { authMiddleware } from '@/middleware/auth.middleware';
import { errorHandler } from '@/middleware/error-handler';
import { globalRateLimit } from '@/middleware/rate-limit.middleware';
import { requestLogger } from '@/middleware/request-logger.middleware';
import { registerProxies } from '@/proxy/proxy';

export interface GatewayApp {
  app: Application;
  server: Server;
}

export const createApp = (): GatewayApp => {
  const app = express();
  // Created here (not in index.ts) because the realtime-service proxy route
  // needs the http.Server instance to wire up WebSocket 'upgrade' handling
  // before the 404/error handlers are registered below.
  const server = createServer(app);

  app.use(helmet());
  // Auth is Bearer-token based (Authorization header), not cookies, so there is
  // no need for credentialed CORS — and `credentials: true` together with a
  // wildcard origin is invalid per the CORS spec (browsers ignore/reject it).
  app.use(cors({ origin: '*' }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(requestLogger);
  app.use(globalRateLimit);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'gateway' });
  });

  // JWT validation before proxying (public paths are exempted inside the middleware)
  app.use(authMiddleware);

  // Proxy routes to downstream services (must be registered before the 404 handler)
  registerProxies(app, server);

  app.use((_req, res) => {
    res.status(404).json({ message: 'Not Found' });
  });

  app.use(errorHandler);

  return { app, server };
};
