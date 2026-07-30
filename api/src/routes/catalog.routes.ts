import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, paginate, paginationSchema } from '../lib/http.js';
import { validate } from '../middleware/validate.js';
import { optionalAuth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { containsInsensitive } from '../lib/search.js';
import { notFound } from '../lib/errors.js';
import { boundingBox, haversineMeters } from '../lib/geo.js';
import { placeInclude, savedPlaceIdsFor, serializePlace } from '../services/places.service.js';

export const catalogRouter = Router();

catalogRouter.get(
  '/countries',
  asyncHandler(async (_req, res) => {
    const countries = await prisma.country.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { cities: true, places: true } } },
    });

    res.json({
      items: countries.map((country) => ({
        id: country.id,
        name: country.name,
        code: country.code,
        slug: country.slug,
        cityCount: country._count.cities,
        placeCount: country._count.places,
      })),
    });
  }),
);

catalogRouter.get(
  '/cities',
  validate(
    z.object({
      countryId: z.string().optional(),
      search: z.string().trim().max(80).optional(),
    }),
    'query',
  ),
  asyncHandler(async (req, res) => {
    const { countryId, search } = req.query as { countryId?: string; search?: string };

    const cities = await prisma.city.findMany({
      where: {
        isActive: true,
        ...(countryId ? { countryId } : {}),
        ...(search ? { name: containsInsensitive(search) } : {}),
      },
      orderBy: { name: 'asc' },
      include: {
        country: { select: { id: true, name: true, code: true } },
        _count: { select: { places: { where: { status: 'ACTIVE' } } } },
      },
    });

    res.json({
      items: cities.map((city) => ({
        id: city.id,
        name: city.name,
        slug: city.slug,
        latitude: city.latitude,
        longitude: city.longitude,
        timezone: city.timezone,
        heroImageUrl: city.heroImageUrl,
        country: city.country,
        placeCount: city._count.places,
      })),
    });
  }),
);

catalogRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    res.json({ items: categories });
  }),
);

const listPlacesQuery = paginationSchema.extend({
  cityId: z.string().optional(),
  countryId: z.string().optional(),
  categoryId: z.string().optional(),
  search: z.string().trim().max(120).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  sort: z.enum(['relevance', 'distance', 'name']).default('relevance'),
});

catalogRouter.get(
  '/places',
  optionalAuth,
  validate(listPlacesQuery, 'query'),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as z.infer<typeof listPlacesQuery>;
    const origin =
      query.latitude !== undefined && query.longitude !== undefined
        ? { latitude: query.latitude, longitude: query.longitude }
        : null;

    const where: Prisma.PlaceWhereInput = {
      status: 'ACTIVE',
      ...(query.cityId ? { cityId: query.cityId } : {}),
      ...(query.countryId ? { countryId: query.countryId } : {}),
      ...(query.categoryId ? { categories: { some: { categoryId: query.categoryId } } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: containsInsensitive(query.search) },
              { shortDescription: containsInsensitive(query.search) },
            ],
          }
        : {}),
    };

    const savedIds = await savedPlaceIdsFor(req.auth?.userId);

    // Distance sorting needs the full matching set, since SQLite cannot order
    // by a computed great-circle distance.
    if (query.sort === 'distance' && origin) {
      const all = await prisma.place.findMany({ where, include: placeInclude });
      const sorted = all
        .map((place) => ({
          place,
          distance: haversineMeters(origin, {
            latitude: place.latitude,
            longitude: place.longitude,
          }),
        }))
        .sort((a, b) => a.distance - b.distance);

      const start = (query.page - 1) * query.limit;
      const items = sorted
        .slice(start, start + query.limit)
        .map((entry) => serializePlace(entry.place, { origin, savedPlaceIds: savedIds }));

      res.json(paginate(items, sorted.length, query.page, query.limit));
      return;
    }

    const orderBy: Prisma.PlaceOrderByWithRelationInput[] =
      query.sort === 'name'
        ? [{ name: 'asc' }]
        : [{ importanceScore: 'desc' }, { name: 'asc' }];

    const [total, places] = await Promise.all([
      prisma.place.count({ where }),
      prisma.place.findMany({
        where,
        include: placeInclude,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    res.json(
      paginate(
        places.map((place) => serializePlace(place, { origin, savedPlaceIds: savedIds })),
        total,
        query.page,
        query.limit,
      ),
    );
  }),
);

catalogRouter.get(
  '/places/nearby',
  optionalAuth,
  validate(
    z.object({
      latitude: z.coerce.number().min(-90).max(90),
      longitude: z.coerce.number().min(-180).max(180),
      radiusMeters: z.coerce.number().int().min(100).max(200_000).default(25_000),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    }),
    'query',
  ),
  asyncHandler(async (req, res) => {
    const { latitude, longitude, radiusMeters, limit } = req.query as unknown as {
      latitude: number;
      longitude: number;
      radiusMeters: number;
      limit: number;
    };
    const origin = { latitude, longitude };
    const box = boundingBox(origin, radiusMeters);

    const places = await prisma.place.findMany({
      where: {
        status: 'ACTIVE',
        latitude: { gte: box.minLatitude, lte: box.maxLatitude },
        longitude: { gte: box.minLongitude, lte: box.maxLongitude },
      },
      include: placeInclude,
    });

    const savedIds = await savedPlaceIdsFor(req.auth?.userId);
    const items = places
      .map((place) => ({
        place,
        distance: haversineMeters(origin, {
          latitude: place.latitude,
          longitude: place.longitude,
        }),
      }))
      .filter((entry) => entry.distance <= radiusMeters)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit)
      .map((entry) => serializePlace(entry.place, { origin, savedPlaceIds: savedIds }));

    res.json({ items });
  }),
);

catalogRouter.get(
  '/places/:id',
  optionalAuth,
  validate(
    z.object({
      latitude: z.coerce.number().min(-90).max(90).optional(),
      longitude: z.coerce.number().min(-180).max(180).optional(),
    }),
    'query',
  ),
  asyncHandler(async (req, res) => {
    const place = await prisma.place.findFirst({
      where: { id: req.params.id, status: 'ACTIVE' },
      include: placeInclude,
    });
    if (!place) throw notFound('Place not found');

    const query = req.query as { latitude?: number; longitude?: number };
    const origin =
      query.latitude !== undefined && query.longitude !== undefined
        ? { latitude: query.latitude, longitude: query.longitude }
        : null;

    const savedIds = await savedPlaceIdsFor(req.auth?.userId);
    res.json({ place: serializePlace(place, { origin, savedPlaceIds: savedIds }) });
  }),
);
