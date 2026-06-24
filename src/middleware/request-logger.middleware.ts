import type { RequestHandler } from 'express';
import { logger } from '@/utils/logger';

export const requestLogger: RequestHandler = (req, res, next) => {
  const start = Date.now();
  const { method, path } = req;

  res.on('finish', () => {
    logger.info({
      method,
      path,
      status: res.statusCode,
      durationMs: Date.now() - start,
      userId: req.headers['x-user-id'],
    }, 'request');
  });

  next();
};
