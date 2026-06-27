import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { propagation, context, trace } from '@opentelemetry/api';
import type { Application, RequestHandler } from 'express';
import type { Server } from 'http';
import type { IncomingMessage, ServerResponse } from 'http';
import { env } from '@/config/env';
import { logger } from '@/utils/logger';
import { authRateLimit } from '@/middleware/rate-limit.middleware';

interface ProxyRoute {
  path: string;
  target: string;
  pathRewrite?: Record<string, string>;
  extraMiddleware?: RequestHandler[];
  ws?: boolean;
}

// NOTE on pathRewrite: when a proxy middleware is mounted via `app.use(path, mw)`,
// Express strips `path` from `req.url` before calling `mw` — the middleware never
// sees the original `/api/auth/...` prefix, only the remainder (e.g. `/register`).
// So `pathRewrite` patterns must match what's LEFT after that stripping (`^/`),
// not the original mount path, or they silently never match and the request gets
// forwarded to the wrong backend path (e.g. `/register` instead of `/auth/register`).
const routes: ProxyRoute[] = [
  {
    path: '/api/auth',
    target: env.AUTH_SERVICE_URL,
    pathRewrite: { '^/': '/auth/' },
    extraMiddleware: [authRateLimit],
  },
  {
    path: '/api/users',
    target: env.USER_SERVICE_URL,
    pathRewrite: { '^/': '/users/' },
  },
  {
    path: '/api/conversations',
    target: env.CHAT_SERVICE_URL,
    pathRewrite: { '^/': '/conversations/' },
  },
  {
    path: '/api/media',
    target: env.MULTIMEDIA_SERVICE_URL,
    pathRewrite: { '^/': '/media/' },
  },
  {
    path: '/api/notifications',
    target: env.NOTIFICATION_SERVICE_URL,
    pathRewrite: { '^/': '/notifications/' },
  },
  {
    // Socket.IO path served by realtime-service (see ws.gateway.ts: path '/events').
    // No pathRewrite — realtime-service expects this exact path.
    path: '/events',
    target: env.REALTIME_SERVICE_URL,
    ws: true,
  },
];

export const registerProxies = (app: Application, server: Server): void => {
  for (const route of routes) {
    const proxyMiddleware = createProxyMiddleware({
      target: route.target,
      changeOrigin: true,
      ws: route.ws,
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
        proxyReq: (proxyReq, req) => {
          // express.json()/urlencoded() upstream already consumed the original
          // request stream to populate req.body — without re-serializing it here,
          // every proxied POST/PUT/PATCH would hang forever waiting for a body
          // that was already drained (the backend never receives it).
          fixRequestBody(proxyReq, req);
          // Propagate the active trace context (W3C traceparent/tracestate) to the
          // downstream service so spans created there join the same trace started
          // at the gateway, instead of starting a brand-new disconnected trace.
          propagation.inject(context.active(), proxyReq, {
            set: (carrier, key, value) => carrier.setHeader(key, value),
          });
          logger.debug(
            { path: req.url, target: route.target, traceId: trace.getActiveSpan()?.spanContext().traceId },
            'Proxying request',
          );
        },
      },
    });

    if (route.ws) {
      server.on('upgrade', proxyMiddleware.upgrade);
    }

    if (route.extraMiddleware?.length) {
      app.use(route.path, ...route.extraMiddleware, proxyMiddleware);
    } else {
      app.use(route.path, proxyMiddleware);
    }
  }
};
