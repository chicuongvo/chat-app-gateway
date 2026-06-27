import jwt from 'jsonwebtoken';
import { GatewayError } from '@/middleware/error-handler';
import type { RequestHandler } from 'express';
import { env } from '@/config/env';

/**
 * Paths that do not require a valid JWT.
 * These are forwarded to the auth-service directly.
 */
const PUBLIC_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/google',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/health',
]);

interface JwtPayload {
  sub?: string;
  id?: string;
  iat?: number;
  exp?: number;
}

export const authMiddleware: RequestHandler = (req, _res, next) => {
  if (PUBLIC_PATHS.has(req.path)) {
    // No JWT to verify yet (this *is* the login/register/etc. call), but the
    // backend's own internal-auth middleware still requires x-internal-token
    // on every non-/health route — without this, register/login would 401.
    req.headers['x-internal-token'] = env.INTERNAL_API_TOKEN;
    return next();
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new GatewayError(401, 'Missing or invalid Authorization header'));
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const userId = payload.sub ?? payload.id;

    if (!userId) {
      return next(new GatewayError(401, 'Invalid token payload'));
    }

    // Inject user id for downstream services
    req.headers['x-user-id'] = userId;
    // Inject internal token so downstream services accept the request
    req.headers['x-internal-token'] = env.INTERNAL_API_TOKEN;

    return next();
  } catch {
    return next(new GatewayError(401, 'Invalid or expired token'));
  }
};
