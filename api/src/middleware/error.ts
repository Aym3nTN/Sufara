import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import multer from 'multer';
import { AppError } from '../lib/errors.js';
import { zodToAppError } from './validate.js';
import { isProduction } from '../config/env.js';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `No route matches ${req.method} ${req.path}` },
  });
}

export function errorHandler(error: unknown, _req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(error);

  const normalised = normalise(error);

  if (normalised.status >= 500 && !isProduction) {
    console.error(error);
  }

  res.status(normalised.status).json({
    error: {
      code: normalised.code,
      message: normalised.message,
      ...(normalised.details ? { details: normalised.details } : {}),
    },
  });
}

function normalise(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) return zodToAppError(error);

  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE' ? 'Image must be 8 MB or smaller' : 'Upload rejected';
    return new AppError(400, 'UPLOAD_ERROR', message);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return new AppError(409, 'CONFLICT', 'A record with these values already exists', {
        target: error.meta?.target,
      });
    }
    if (error.code === 'P2025') {
      return new AppError(404, 'NOT_FOUND', 'Resource not found');
    }
    if (error.code === 'P2003') {
      return new AppError(409, 'CONFLICT', 'This record is still referenced by other data');
    }
  }

  return new AppError(
    500,
    'INTERNAL_ERROR',
    isProduction ? 'Something went wrong' : String((error as Error)?.message ?? error),
  );
}
