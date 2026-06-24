import { createProxyMiddleware } from 'http-proxy-middleware';
import type { Application, RequestHandler } from 'express';
import type { IncomingMessage, ServerResponse } from 'http';
import { env } from '@/config/env';
import { logger } from '@/utils/logger';
import { authRateLimit } from '@/middleware/rate-limit.middleware';

interface ProxyRoute {
  path: string;
  target: string;
  pathRewrite?: Record<string, string>;
  extraMiddleware?: RequestHandler[];
}

const routes: ProxyRoute[] = [
  {
    path: '/api/auth',
    target: env.AUTH_SERVICE_URL,
    pathRewrite: { '^/api/auth': '/auth' },
    extraMiddleware: [authRateLimit],
  },
  {
    path: '/api/users',
    target: env.USER_SERVICE_URL,
    pathRewrite: { '^/api/users': '/users' },
  },
  {
    path: '/api/conversations',
    target: env.CHAT_SERVICE_URL,
    pathRewrite: { '^/api/conversations': '/conversations' },
  },
  {
    path: '/api/media',
    target: env.MULTIMEDIA_SERVICE_URL,
    pathRewrite: { '^/api/media': '/media' },
  },
  {
    path: '/api/notifications',
    target: env.NOTIFICATION_SERVICE_URL,
    pathRewrite: { '^/api/notifications': '/notifications' },
  },
];

export const registerProxies = (app: Application): void => {
  for (const route of routes) {
    const proxyMiddleware = createProxyMiddleware({
      target: route.target,
      changeOrigin: true,
      pathRewrite: route.pathRewrite,
      on: {
        error: (err, req, res) => {
          logger.error({ err, path: (req as IncomingMessage).url, target: route.target }, 'Proxy error');
          const httpRes = res as ServerResponse;
          if (typeof httpRes.writeHead === 'function' && !httpRes.headersSent) {
            httpRes.writeHead(502, { 'Content-Type': 'application/json' });
            httpRes.end(JSON.stringify({ message: 'Bad Gateway' }));
          }
        },
        proxyReq: (_proxyReq, req) => {
          logger.debug({ path: req.url, target: route.target }, 'Proxying request');
        },
      },
    });

    if (route.extraMiddleware?.length) {
      app.use(route.path, ...route.extraMiddleware, proxyMiddleware);
    } else {
      app.use(route.path, proxyMiddleware);
    }
  }
};
