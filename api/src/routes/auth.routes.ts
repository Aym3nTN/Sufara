import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/http.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { notFound } from '../lib/errors.js';
import { isProduction } from '../config/env.js';
import {
  authenticate,
  createPasswordResetToken,
  issueTokens,
  registerUser,
  resetPassword,
  revokeRefreshToken,
  rotateRefreshToken,
  toPublicUser,
} from '../services/auth.service.js';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long');

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  password: passwordSchema,
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({ refreshToken: z.string().min(10) });

export const authRouter = Router();

authRouter.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    // Role is never taken from the request body: self-registration is always USER.
    const user = await registerUser(req.body);
    const tokens = await issueTokens(user);
    res.status(201).json({ user: toPublicUser(user), ...tokens });
  }),
);

authRouter.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const user = await authenticate(req.body.email, req.body.password);
    const tokens = await issueTokens(user);
    res.json({ user: toPublicUser(user), ...tokens });
  }),
);

authRouter.post(
  '/refresh',
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    res.json(await rotateRefreshToken(req.body.refreshToken));
  }),
);

authRouter.post(
  '/logout',
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    await revokeRefreshToken(req.body.refreshToken);
    res.status(204).send();
  }),
);

authRouter.post(
  '/forgot-password',
  validate(z.object({ email: z.string().trim().email() })),
  asyncHandler(async (req, res) => {
    const token = await createPasswordResetToken(req.body.email);
    // Always the same response: whether an account exists must not leak.
    res.json({
      message: 'If an account exists for that address, a reset link has been sent.',
      // Without a mail provider wired up, dev/test returns the token directly.
      ...(isProduction ? {} : { devResetToken: token }),
    });
  }),
);

authRouter.post(
  '/reset-password',
  validate(z.object({ token: z.string().min(10), password: passwordSchema })),
  asyncHandler(async (req, res) => {
    await resetPassword(req.body.token, req.body.password);
    res.json({ message: 'Your password has been updated.' });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!user) throw notFound('User not found');
    res.json({ user: toPublicUser(user) });
  }),
);
