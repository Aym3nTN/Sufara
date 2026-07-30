import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/http.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { containsInsensitive } from '../lib/search.js';
import { notFound } from '../lib/errors.js';
import { TRAVEL_MODES, WALKING_TOLERANCES } from '../domain/constants.js';
import { placeInclude, serializePlace } from '../services/places.service.js';
import { hashPassword, toPublicUser, verifyPassword } from '../services/auth.service.js';
import { unauthorized } from '../lib/errors.js';

export const meRouter = Router();
meRouter.use(requireAuth);

meRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      include: {
        preference: true,
        interests: { include: { category: true } },
        _count: { select: { savedPlaces: true, itineraries: true } },
      },
    });
    if (!user) throw notFound('User not found');

    const visitedPlaces = await prisma.itineraryStop.count({
      where: { itinerary: { userId: user.id }, completedAt: { not: null } },
    });

    res.json({
      user: toPublicUser(user),
      preferences: {
        travelMode: user.preference?.travelMode ?? 'DRIVING',
        walkingTolerance: user.preference?.walkingTolerance ?? 'MEDIUM',
        maxWalkingMeters: user.preference?.maxWalkingMeters ?? 2000,
        interestCategoryIds: user.interests.map((i) => i.categoryId),
        interests: user.interests.map((i) => i.category),
      },
      stats: {
        trips: user._count.itineraries,
        savedPlaces: user._count.savedPlaces,
        placesVisited: visitedPlaces,
      },
    });
  }),
);

meRouter.put(
  '/',
  validate(
    z.object({
      name: z.string().trim().min(2).max(80).optional(),
      avatarUrl: z.string().url().max(500).nullable().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({ where: { id: req.auth!.userId }, data: req.body });
    res.json({ user: toPublicUser(user) });
  }),
);

meRouter.post(
  '/change-password',
  validate(
    z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8).max(128),
    }),
  ),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!user) throw notFound('User not found');

    const ok = await verifyPassword(req.body.currentPassword, user.passwordHash);
    if (!ok) throw unauthorized('Current password is incorrect');

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(req.body.newPassword) },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    res.json({ message: 'Password updated. Other devices have been signed out.' });
  }),
);

const preferencesSchema = z.object({
  travelMode: z.enum(TRAVEL_MODES).optional(),
  walkingTolerance: z.enum(WALKING_TOLERANCES).optional(),
  maxWalkingMeters: z.number().int().min(200).max(20_000).optional(),
  interestCategoryIds: z.array(z.string()).max(20).optional(),
});

meRouter.get(
  '/preferences',
  asyncHandler(async (req, res) => {
    const [preference, interests] = await Promise.all([
      prisma.userPreference.findUnique({ where: { userId: req.auth!.userId } }),
      prisma.userInterest.findMany({
        where: { userId: req.auth!.userId },
        include: { category: true },
      }),
    ]);

    res.json({
      travelMode: preference?.travelMode ?? 'DRIVING',
      walkingTolerance: preference?.walkingTolerance ?? 'MEDIUM',
      maxWalkingMeters: preference?.maxWalkingMeters ?? 2000,
      interestCategoryIds: interests.map((i) => i.categoryId),
      interests: interests.map((i) => i.category),
    });
  }),
);

meRouter.put(
  '/preferences',
  validate(preferencesSchema),
  asyncHandler(async (req, res) => {
    const userId = req.auth!.userId;
    const body = req.body as z.infer<typeof preferencesSchema>;

    const { interestCategoryIds, ...rest } = body;

    const preference = await prisma.userPreference.upsert({
      where: { userId },
      create: { userId, ...rest },
      update: rest,
    });

    if (interestCategoryIds) {
      const valid = await prisma.category.findMany({
        where: { id: { in: interestCategoryIds }, isActive: true },
        select: { id: true },
      });

      await prisma.$transaction([
        prisma.userInterest.deleteMany({ where: { userId } }),
        prisma.userInterest.createMany({
          data: valid.map((category) => ({ userId, categoryId: category.id })),
        }),
      ]);
    }

    const interests = await prisma.userInterest.findMany({
      where: { userId },
      include: { category: true },
    });

    res.json({
      travelMode: preference.travelMode,
      walkingTolerance: preference.walkingTolerance,
      maxWalkingMeters: preference.maxWalkingMeters,
      interestCategoryIds: interests.map((i) => i.categoryId),
      interests: interests.map((i) => i.category),
    });
  }),
);

meRouter.get(
  '/saved-places',
  validate(z.object({ cityId: z.string().optional(), search: z.string().max(120).optional() }), 'query'),
  asyncHandler(async (req, res) => {
    const { cityId, search } = req.query as { cityId?: string; search?: string };

    const saved = await prisma.savedPlace.findMany({
      where: {
        userId: req.auth!.userId,
        place: {
          ...(cityId ? { cityId } : {}),
          ...(search ? { name: containsInsensitive(search) } : {}),
        },
      },
      include: { place: { include: placeInclude } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      items: saved.map((entry) => ({
        savedAt: entry.createdAt,
        note: entry.note,
        place: serializePlace(entry.place, { savedPlaceIds: new Set([entry.placeId]) }),
      })),
    });
  }),
);

meRouter.post(
  '/saved-places',
  validate(z.object({ placeId: z.string().min(1), note: z.string().max(500).optional() })),
  asyncHandler(async (req, res) => {
    const place = await prisma.place.findUnique({ where: { id: req.body.placeId } });
    if (!place) throw notFound('Place not found');

    await prisma.savedPlace.upsert({
      where: { userId_placeId: { userId: req.auth!.userId, placeId: place.id } },
      create: { userId: req.auth!.userId, placeId: place.id, note: req.body.note },
      update: { note: req.body.note },
    });

    res.status(201).json({ saved: true, placeId: place.id });
  }),
);

meRouter.delete(
  '/saved-places/:placeId',
  asyncHandler(async (req, res) => {
    await prisma.savedPlace.deleteMany({
      where: { userId: req.auth!.userId, placeId: req.params.placeId },
    });
    res.status(204).send();
  }),
);
