import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { User } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { conflict, unauthorized } from '../lib/errors.js';
import type { Role } from '../domain/constants.js';

const BCRYPT_ROUNDS = 10;

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  email: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export const hashPassword = (plain: string) => bcrypt.hash(plain, BCRYPT_ROUNDS);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export function signAccessToken(user: Pick<User, 'id' | 'role' | 'email'>): string {
  return jwt.sign({ role: user.role as Role, email: user.email }, env.JWT_ACCESS_SECRET, {
    subject: user.id,
    expiresIn: `${env.ACCESS_TOKEN_TTL_MINUTES}m`,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
    if (!decoded.sub) throw new Error('missing subject');
    return {
      sub: String(decoded.sub),
      role: decoded.role as Role,
      email: String(decoded.email ?? ''),
    };
  } catch {
    throw unauthorized('Your session has expired. Please sign in again.');
  }
}

/**
 * Refresh tokens are opaque, stored hashed, and single-use: presenting one
 * rotates it. A leaked token is therefore revocable and detectable.
 */
export async function issueTokens(user: User): Promise<AuthTokens> {
  const refreshToken = randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: sha256(refreshToken), expiresAt },
  });

  return {
    accessToken: signAccessToken(user),
    refreshToken,
    expiresInSeconds: env.ACCESS_TOKEN_TTL_MINUTES * 60,
  };
}

export async function rotateRefreshToken(refreshToken: string): Promise<AuthTokens> {
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(refreshToken) },
    include: { user: true },
  });

  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    throw unauthorized('Invalid or expired refresh token');
  }
  if (!record.user.isActive) throw unauthorized('This account is disabled');

  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });

  return issueTokens(record.user);
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: sha256(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function registerUser(input: {
  email: string;
  password: string;
  name: string;
  role?: Role;
}): Promise<User> {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw conflict('An account with this email already exists');

  return prisma.user.create({
    data: {
      email,
      name: input.name.trim(),
      passwordHash: await hashPassword(input.password),
      role: input.role ?? 'USER',
      preference: { create: {} },
    },
  });
}

export async function authenticate(email: string, password: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });

  // Always run a comparison so a missing account and a wrong password take
  // comparable time and cannot be distinguished by an attacker.
  const hash = user?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvaliduO';
  const ok = await verifyPassword(password, hash);

  if (!user || !ok) throw unauthorized('Email or password is incorrect');
  if (!user.isActive) throw unauthorized('This account is disabled');

  return user;
}

export async function createPasswordResetToken(email: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) return null;

  const token = randomBytes(32).toString('base64url');
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return token;
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw unauthorized('This password reset link is invalid or has expired');
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hashPassword(newPassword) },
    }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Changing the password invalidates every existing session.
    prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}

export function toPublicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}
