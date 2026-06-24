import type { ErrorRequestHandler } from 'express';
import { logger } from '@/utils/logger';

export class GatewayError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const isGatewayError = err instanceof GatewayError;

  if (!isGatewayError) {
    logger.error({ err }, 'Unhandled gateway error');
  }

  const statusCode = isGatewayError ? err.statusCode : 502;
  const message = statusCode >= 500 ? 'Bad Gateway' : (err as Error).message;

  res.status(statusCode).json({ message });
};
