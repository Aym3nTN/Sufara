import { Router } from 'express';
import multer from 'multer';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, paginate, paginationSchema } from '../lib/http.js';
import { validate } from '../middleware/validate.js';
import { requireAdmin } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { containsInsensitive } from '../lib/search.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { PLACE_STATUSES, ROLES } from '../domain/constants.js';
import {
  placeInclude,
  serializePlace,
  slugify,
  uniquePlaceSlug,
} from '../services/places.service.js';
import { buildStorageKey, getStorageProvider } from '../services/storage/index.js';
import { MAX_UPLOAD_BYTES, processPlaceImage } from '../services/images.js';
import { toPublicUser } from '../services/auth.service.js';

export const adminRouter = Router();
// Every admin route is authenticated and role-checked on the server. The mobile
// app hiding the admin tab is presentation only and is never relied upon.
adminRouter.use(requireAdmin);

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

adminRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [places, countries, cities, users, drafts, recentPlaces, recentUsers, byCategory] =
      await Promise.all([
        prisma.place.count(),
        prisma.country.count(),
        prisma.city.count(),
        prisma.user.count(),
        prisma.place.count({ where: { status: 'DRAFT' } }),
        prisma.place.findMany({
          orderBy: { createdAt: 'desc' },
          take: 6,
          include: { city: { select: { name: true } }, primaryCategory: { select: { name: true } } },
        }),
        prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 6 }),
        prisma.category.findMany({
          select: { id: true, name: true, _count: { select: { places: true } } },
          orderBy: { sortOrder: 'asc' },
        }),
      ]);

    res.json({
      totals: { places, countries, cities, users, placesAwaitingReview: drafts },
      recentPlaces: recentPlaces.map((place) => ({
        id: place.id,
        name: place.name,
        cityName: place.city.name,
        categoryName: place.primaryCategory.name,
        status: place.status,
        createdAt: place.createdAt,
      })),
      recentUsers: recentUsers.map(toPublicUser),
      placesByCategory: byCategory.map((category) => ({
        id: category.id,
        name: category.name,
        count: category._count.places,
      })),
    });
  }),
);

// ---------------------------------------------------------------------------
// Countries
// ---------------------------------------------------------------------------

const countrySchema = z.object({
  name: z.string().trim().min(2).max(80),
  code: z.string().trim().length(2).toUpperCase(),
  isActive: z.boolean().default(true),
});

adminRouter.get(
  '/countries',
  asyncHandler(async (_req, res) => {
    const countries = await prisma.country.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { cities: true, places: true } } },
    });
    res.json({
      items: countries.map((country) => ({
        ...country,
        cityCount: country._count.cities,
        placeCount: country._count.places,
      })),
    });
  }),
);

adminRouter.post(
  '/countries',
  validate(countrySchema),
  asyncHandler(async (req, res) => {
    const country = await prisma.country.create({
      data: { ...req.body, slug: slugify(req.body.name) },
    });
    res.status(201).json({ country });
  }),
);

adminRouter.put(
  '/countries/:id',
  validate(countrySchema.partial()),
  asyncHandler(async (req, res) => {
    const data = { ...req.body };
    if (req.body.name) data.slug = slugify(req.body.name);
    const country = await prisma.country.update({ where: { id: req.params.id }, data });
    res.json({ country });
  }),
);

adminRouter.delete(
  '/countries/:id',
  asyncHandler(async (req, res) => {
    const cityCount = await prisma.city.count({ where: { countryId: req.params.id } });
    if (cityCount > 0) {
      throw conflict('Remove or reassign this country’s cities before deleting it');
    }
    await prisma.country.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);

// ---------------------------------------------------------------------------
// Cities
// ---------------------------------------------------------------------------

const citySchema = z.object({
  name: z.string().trim().min(2).max(80),
  countryId: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().trim().max(60).default('UTC'),
  heroImageUrl: z.string().url().max(500).nullable().optional(),
  isActive: z.boolean().default(true),
});

adminRouter.get(
  '/cities',
  validate(z.object({ countryId: z.string().optional() }), 'query'),
  asyncHandler(async (req, res) => {
    const { countryId } = req.query as { countryId?: string };
    const cities = await prisma.city.findMany({
      where: countryId ? { countryId } : {},
      orderBy: [{ country: { name: 'asc' } }, { name: 'asc' }],
      include: {
        country: { select: { id: true, name: true, code: true } },
        _count: { select: { places: true } },
      },
    });
    res.json({ items: cities.map((city) => ({ ...city, placeCount: city._count.places })) });
  }),
);

adminRouter.post(
  '/cities',
  validate(citySchema),
  asyncHandler(async (req, res) => {
    const country = await prisma.country.findUnique({ where: { id: req.body.countryId } });
    if (!country) throw notFound('Country not found');

    const city = await prisma.city.create({
      data: { ...req.body, slug: slugify(req.body.name) },
      include: { country: { select: { id: true, name: true, code: true } } },
    });
    res.status(201).json({ city });
  }),
);

adminRouter.put(
  '/cities/:id',
  validate(citySchema.partial()),
  asyncHandler(async (req, res) => {
    const data = { ...req.body };
    if (req.body.name) data.slug = slugify(req.body.name);
    const city = await prisma.city.update({
      where: { id: req.params.id },
      data,
      include: { country: { select: { id: true, name: true, code: true } } },
    });
    res.json({ city });
  }),
);

adminRouter.delete(
  '/cities/:id',
  asyncHandler(async (req, res) => {
    const placeCount = await prisma.place.count({ where: { cityId: req.params.id } });
    if (placeCount > 0) {
      throw conflict('Remove or reassign this city’s places before deleting it');
    }
    await prisma.city.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

const categorySchema = z.object({
  key: z.string().trim().min(2).max(40).toUpperCase(),
  name: z.string().trim().min(2).max(60),
  icon: z.string().trim().max(40).default('place'),
  colorHex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour such as #1F6F54')
    .default('#1F6F54'),
  sortOrder: z.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

adminRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { places: true } } },
    });
    res.json({
      items: categories.map((category) => ({ ...category, placeCount: category._count.places })),
    });
  }),
);

adminRouter.post(
  '/categories',
  validate(categorySchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ category: await prisma.category.create({ data: req.body }) });
  }),
);

adminRouter.put(
  '/categories/:id',
  validate(categorySchema.partial()),
  asyncHandler(async (req, res) => {
    const category = await prisma.category.update({ where: { id: req.params.id }, data: req.body });
    res.json({ category });
  }),
);

adminRouter.delete(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    const inUse = await prisma.place.count({ where: { primaryCategoryId: req.params.id } });
    if (inUse > 0) throw conflict('This category is still the primary category of some places');
    await prisma.category.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);

// ---------------------------------------------------------------------------
// Places
// ---------------------------------------------------------------------------

const openingHourSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  opensMinutes: z.number().int().min(0).max(1440),
  closesMinutes: z.number().int().min(0).max(1440),
  isClosed: z.boolean().default(false),
});

const placeSchema = z.object({
  name: z.string().trim().min(2).max(140),
  shortDescription: z.string().trim().min(5).max(300),
  description: z.string().trim().min(10).max(8000),
  countryId: z.string().min(1),
  cityId: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  primaryCategoryId: z.string().min(1),
  categoryIds: z.array(z.string()).max(8).default([]),
  estimatedVisitDurationMinutes: z.number().int().min(5).max(600),
  importanceScore: z.number().int().min(1).max(100),
  status: z.enum(PLACE_STATUSES).default('ACTIVE'),
  address: z.string().trim().max(300).nullable().optional(),
  website: z.string().url().max(300).nullable().optional(),
  historicalPeriod: z.string().trim().max(120).nullable().optional(),
  religiousSignificance: z.string().trim().max(2000).nullable().optional(),
  openingHours: z.array(openingHourSchema).max(7).optional(),
});

/** Country/city must actually be related — the hierarchy is not decorative. */
async function assertGeography(countryId: string, cityId: string) {
  const city = await prisma.city.findUnique({ where: { id: cityId } });
  if (!city) throw notFound('City not found');
  if (city.countryId !== countryId) {
    throw badRequest('The selected city does not belong to the selected country');
  }
}

adminRouter.get(
  '/places',
  validate(
    paginationSchema.extend({
      search: z.string().trim().max(120).optional(),
      cityId: z.string().optional(),
      countryId: z.string().optional(),
      categoryId: z.string().optional(),
      status: z.enum(PLACE_STATUSES).optional(),
    }),
    'query',
  ),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as {
      page: number;
      limit: number;
      search?: string;
      cityId?: string;
      countryId?: string;
      categoryId?: string;
      status?: string;
    };

    const where: Prisma.PlaceWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.cityId ? { cityId: query.cityId } : {}),
      ...(query.countryId ? { countryId: query.countryId } : {}),
      ...(query.categoryId ? { categories: { some: { categoryId: query.categoryId } } } : {}),
      ...(query.search ? { name: containsInsensitive(query.search) } : {}),
    };

    const [total, places] = await Promise.all([
      prisma.place.count({ where }),
      prisma.place.findMany({
        where,
        include: placeInclude,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    res.json(paginate(places.map((place) => serializePlace(place)), total, query.page, query.limit));
  }),
);

adminRouter.get(
  '/places/:id',
  asyncHandler(async (req, res) => {
    const place = await prisma.place.findUnique({ where: { id: req.params.id }, include: placeInclude });
    if (!place) throw notFound('Place not found');
    res.json({ place: serializePlace(place) });
  }),
);

adminRouter.post(
  '/places',
  validate(placeSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof placeSchema>;
    await assertGeography(body.countryId, body.cityId);

    const { categoryIds, openingHours, ...rest } = body;
    const categorySet = new Set([...categoryIds, body.primaryCategoryId]);

    const place = await prisma.place.create({
      data: {
        ...rest,
        slug: await uniquePlaceSlug(body.cityId, body.name),
        createdById: req.auth!.userId,
        categories: { create: [...categorySet].map((categoryId) => ({ categoryId })) },
        ...(openingHours ? { openingHours: { create: openingHours } } : {}),
      },
      include: placeInclude,
    });

    res.status(201).json({ place: serializePlace(place) });
  }),
);

adminRouter.put(
  '/places/:id',
  validate(placeSchema.partial()),
  asyncHandler(async (req, res) => {
    const existing = await prisma.place.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Place not found');

    const body = req.body as Partial<z.infer<typeof placeSchema>>;
    const countryId = body.countryId ?? existing.countryId;
    const cityId = body.cityId ?? existing.cityId;
    await assertGeography(countryId, cityId);

    const { categoryIds, openingHours, ...rest } = body;

    const place = await prisma.$transaction(async (tx) => {
      if (categoryIds) {
        const primary = body.primaryCategoryId ?? existing.primaryCategoryId;
        const categorySet = new Set([...categoryIds, primary]);
        await tx.placeCategory.deleteMany({ where: { placeId: existing.id } });
        await tx.placeCategory.createMany({
          data: [...categorySet].map((categoryId) => ({ placeId: existing.id, categoryId })),
        });
      }
      if (openingHours) {
        await tx.openingHour.deleteMany({ where: { placeId: existing.id } });
        if (openingHours.length > 0) {
          await tx.openingHour.createMany({
            data: openingHours.map((hour) => ({ ...hour, placeId: existing.id })),
          });
        }
      }

      return tx.place.update({
        where: { id: existing.id },
        data: {
          ...rest,
          ...(body.name ? { slug: await uniquePlaceSlug(cityId, body.name, existing.id) } : {}),
        },
        include: placeInclude,
      });
    });

    res.json({ place: serializePlace(place) });
  }),
);

adminRouter.delete(
  '/places/:id',
  asyncHandler(async (req, res) => {
    const usedInTrips = await prisma.itineraryStop.count({ where: { placeId: req.params.id } });
    if (usedInTrips > 0) {
      throw conflict(
        'This place appears in saved itineraries. Deactivate it instead of deleting it.',
      );
    }

    const photos = await prisma.photo.findMany({ where: { placeId: req.params.id } });
    const storage = getStorageProvider();
    await Promise.all(photos.map((photo) => storage.remove(photo.storageKey)));

    await prisma.place.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

adminRouter.post(
  '/places/:id/photos',
  upload.single('photo'),
  asyncHandler(async (req, res) => {
    const place = await prisma.place.findUnique({ where: { id: req.params.id } });
    if (!place) throw notFound('Place not found');
    if (!req.file) throw badRequest('Attach an image in the "photo" field');

    const processed = await processPlaceImage(req.file.buffer);
    const storage = getStorageProvider();

    const key = buildStorageKey(`places/${place.id}`, processed.display, processed.extension);
    const thumbKey = key.replace(/\.jpg$/, '-thumb.jpg');

    const [stored] = await Promise.all([
      storage.put(key, processed.display, processed.contentType),
      storage.put(thumbKey, processed.thumbnail, processed.contentType),
    ]);

    const existingCount = await prisma.photo.count({ where: { placeId: place.id } });
    const photo = await prisma.photo.create({
      data: {
        placeId: place.id,
        storageKey: stored.key,
        url: stored.url,
        thumbnailUrl: storage.urlFor(thumbKey),
        caption: typeof req.body?.caption === 'string' ? req.body.caption.slice(0, 200) : null,
        isPrimary: existingCount === 0,
        sortOrder: existingCount,
        width: processed.width,
        height: processed.height,
      },
    });

    res.status(201).json({ photo });
  }),
);

adminRouter.put(
  '/photos/:photoId',
  validate(
    z.object({
      caption: z.string().max(200).nullable().optional(),
      isPrimary: z.boolean().optional(),
      sortOrder: z.number().int().min(0).max(999).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const photo = await prisma.photo.findUnique({ where: { id: req.params.photoId } });
    if (!photo) throw notFound('Photo not found');

    if (req.body.isPrimary) {
      await prisma.photo.updateMany({
        where: { placeId: photo.placeId },
        data: { isPrimary: false },
      });
    }

    res.json({
      photo: await prisma.photo.update({ where: { id: photo.id }, data: req.body }),
    });
  }),
);

adminRouter.delete(
  '/photos/:photoId',
  asyncHandler(async (req, res) => {
    const photo = await prisma.photo.findUnique({ where: { id: req.params.photoId } });
    if (!photo) throw notFound('Photo not found');

    await getStorageProvider().remove(photo.storageKey);
    await prisma.photo.delete({ where: { id: photo.id } });

    // Keep exactly one primary photo per place.
    const next = await prisma.photo.findFirst({
      where: { placeId: photo.placeId },
      orderBy: { sortOrder: 'asc' },
    });
    if (next && photo.isPrimary) {
      await prisma.photo.update({ where: { id: next.id }, data: { isPrimary: true } });
    }

    res.status(204).send();
  }),
);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

adminRouter.get(
  '/users',
  validate(paginationSchema.extend({ search: z.string().trim().max(120).optional() }), 'query'),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as { page: number; limit: number; search?: string };
    const where: Prisma.UserWhereInput = query.search
      ? {
          OR: [
            { name: containsInsensitive(query.search) },
            { email: containsInsensitive(query.search) },
          ],
        }
      : {};

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    res.json(
      paginate(
        users.map((user) => ({ ...toPublicUser(user), isActive: user.isActive })),
        total,
        query.page,
        query.limit,
      ),
    );
  }),
);

adminRouter.put(
  '/users/:id',
  validate(z.object({ role: z.enum(ROLES).optional(), isActive: z.boolean().optional() })),
  asyncHandler(async (req, res) => {
    if (req.params.id === req.auth!.userId) {
      // Prevents an administrator locking every admin out of the dashboard.
      throw badRequest('You cannot change your own role or status');
    }

    const user = await prisma.user.update({ where: { id: req.params.id }, data: req.body });
    if (req.body.isActive === false) {
      await prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    res.json({ user: { ...toPublicUser(user), isActive: user.isActive } });
  }),
);
