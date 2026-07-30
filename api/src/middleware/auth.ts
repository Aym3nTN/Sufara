import type { NextFunction, Request, Response } from 'express';
import { forbidden, unauthorized } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { verifyAccessToken } from '../services/auth.service.js';
import type { Role } from '../domain/constants.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { userId: string; role: Role; email: string };
    }
  }
}

function readBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = readBearer(req);
    if (!token) throw unauthorized();

    const payload = verifyAccessToken(token);

    // The token is only a claim; the database is the authority on whether the
    // account still exists, is still active, and still holds that role.
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, email: true, isActive: true },
    });
    if (!user || !user.isActive) throw unauthorized('This account is no longer active');

    req.auth = { userId: user.id, role: user.role as Role, email: user.email };
    next();
  } catch (error) {
    next(error);
  }
}

/** Attaches the user when a token is present, but never rejects. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readBearer(req);
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, email: true, isActive: true },
    });
    if (user?.isActive) {
      req.auth = { userId: user.id, role: user.role as Role, email: user.email };
    }
  } catch {
    // An invalid token on a public route is simply ignored.
  }
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(unauthorized());
    if (!roles.includes(req.auth.role)) return next(forbidden());
    next();
  };
}

export const requireAdmin = [requireAuth, requireRole('ADMIN')];
