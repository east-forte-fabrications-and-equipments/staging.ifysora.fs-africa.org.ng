import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../domain/errors/AppError.js';
import { logger } from '../../utils/logger.js';
import { ZodError } from 'zod';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const correlationId = (req as any).correlationId || 'unknown';

  // Log the error
  logger.error('Request error:', {
    correlationId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: (req as any).user?.id,
  });

  // Handle known errors
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        correlationId: err.correlationId,
        context: err.context,
      },
    });
    return;
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        correlationId,
        details: err.errors,
      },
    });
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      error: {
        code: 'AUTH_ERROR',
        message: 'Invalid token',
        correlationId,
      },
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      error: {
        code: 'AUTH_ERROR',
        message: 'Token expired',
        correlationId,
      },
    });
    return;
  }

  // Default error
  const isProduction = process.env.NODE_ENV === 'production';
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction ? 'An unexpected error occurred' : err.message,
      correlationId,
      ...(isProduction ? {} : { stack: err.stack }),
    },
  });
}

// Middleware to add correlation ID
export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const id = req.headers['x-correlation-id'] as string || crypto.randomUUID();
  (req as any).correlationId = id;
  global.correlationId = id;
  res.setHeader('X-Correlation-ID', id);
  next();
}
