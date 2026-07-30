import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/http.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { notFound } from '../lib/errors.js';
import { ITINERARY_STATUSES, TRAVEL_MODES } from '../domain/constants.js';
import { placeInclude, serializePlace } from '../services/places.service.js';

export const itinerariesRouter = Router();
itinerariesRouter.use(requireAuth);

const itineraryInclude = {
  stops: { orderBy: { order: 'asc' }, include: { place: { include: placeInclude } } },
} as const;

type ItineraryRecord = Awaited<
  ReturnType<typeof prisma.itinerary.findFirstOrThrow<{ include: typeof itineraryInclude }>>
>;

function serializeItinerary(itinerary: ItineraryRecord) {
  return {
    id: itinerary.id,
    title: itinerary.title,
    cityId: itinerary.cityId,
    cityName: itinerary.stops[0]?.place.city.name ?? null,
    status: itinerary.status,
    travelMode: itinerary.travelMode,
    availableMinutes: itinerary.availableMinutes,
    start: {
      latitude: itinerary.startLatitude,
      longitude: itinerary.startLongitude,
      label: itinerary.startLabel,
    },
    end:
      itinerary.endLatitude !== null && itinerary.endLongitude !== null
        ? { latitude: itinerary.endLatitude, longitude: itinerary.endLongitude }
        : null,
    totals: {
      travelMinutes: itinerary.totalTravelMinutes,
      visitMinutes: itinerary.totalVisitMinutes,
      totalMinutes: itinerary.totalTravelMinutes + itinerary.totalVisitMinutes,
      distanceMeters: itinerary.totalDistanceMeters,
      bufferMinutes: itinerary.bufferMinutes,
    },
    stops: itinerary.stops.map((stop) => ({
      id: stop.id,
      order: stop.order,
      estimatedArrivalOffsetMinutes: stop.estimatedArrivalOffsetMinutes,
      estimatedVisitDurationMinutes: stop.estimatedVisitDurationMinutes,
      travelTimeFromPreviousMinutes: stop.travelTimeFromPreviousMinutes,
      distanceFromPreviousMeters: stop.distanceFromPreviousMeters,
      completedAt: stop.completedAt,
      place: serializePlace(stop.place),
    })),
    startedAt: itinerary.startedAt,
    completedAt: itinerary.completedAt,
    createdAt: itinerary.createdAt,
    updatedAt: itinerary.updatedAt,
  };
}

const stopSchema = z.object({
  placeId: z.string().min(1),
  order: z.number().int().min(1),
  estimatedArrivalOffsetMinutes: z.number().int().min(0).default(0),
  estimatedVisitDurationMinutes: z.number().int().min(0).max(600).default(30),
  travelTimeFromPreviousMinutes: z.number().int().min(0).max(600).default(0),
  distanceFromPreviousMeters: z.number().int().min(0).default(0),
});

const saveSchema = z.object({
  title: z.string().trim().min(2).max(120),
  cityId: z.string().optional(),
  startLabel: z.string().trim().max(120).default('Starting point'),
  startLatitude: z.number().min(-90).max(90),
  startLongitude: z.number().min(-180).max(180),
  endLatitude: z.number().min(-90).max(90).optional(),
  endLongitude: z.number().min(-180).max(180).optional(),
  availableMinutes: z.number().int().min(15).max(16 * 60),
  travelMode: z.enum(TRAVEL_MODES).default('DRIVING'),
  totalTravelMinutes: z.number().int().min(0).default(0),
  totalVisitMinutes: z.number().int().min(0).default(0),
  totalDistanceMeters: z.number().int().min(0).default(0),
  bufferMinutes: z.number().int().default(0),
  status: z.enum(ITINERARY_STATUSES).default('PLANNED'),
  stops: z.array(stopSchema).min(1).max(25),
});

itinerariesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const itineraries = await prisma.itinerary.findMany({
      where: { userId: req.auth!.userId },
      include: itineraryInclude,
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ items: itineraries.map(serializeItinerary) });
  }),
);

itinerariesRouter.post(
  '/',
  validate(saveSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof saveSchema>;
    const { stops, ...rest } = body;

    const known = await prisma.place.findMany({
      where: { id: { in: stops.map((stop) => stop.placeId) } },
      select: { id: true },
    });
    if (known.length !== new Set(stops.map((s) => s.placeId)).size) {
      throw notFound('One or more stops reference a place that no longer exists');
    }

    const itinerary = await prisma.itinerary.create({
      data: {
        ...rest,
        userId: req.auth!.userId,
        stops: { create: stops.map((stop, index) => ({ ...stop, order: index + 1 })) },
      },
      include: itineraryInclude,
    });

    res.status(201).json({ itinerary: serializeItinerary(itinerary) });
  }),
);

async function ownedItinerary(id: string, userId: string) {
  const itinerary = await prisma.itinerary.findFirst({
    where: { id, userId },
    include: itineraryInclude,
  });
  if (!itinerary) throw notFound('Itinerary not found');
  return itinerary;
}

itinerariesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json({ itinerary: serializeItinerary(await ownedItinerary(req.params.id, req.auth!.userId)) });
  }),
);

itinerariesRouter.put(
  '/:id',
  validate(saveSchema.partial({ stops: true })),
  asyncHandler(async (req, res) => {
    const existing = await ownedItinerary(req.params.id, req.auth!.userId);
    const body = req.body as Partial<z.infer<typeof saveSchema>>;
    const { stops, ...rest } = body;

    const itinerary = await prisma.$transaction(async (tx) => {
      if (stops) {
        await tx.itineraryStop.deleteMany({ where: { itineraryId: existing.id } });
        await tx.itineraryStop.createMany({
          data: stops.map((stop, index) => ({
            ...stop,
            order: index + 1,
            itineraryId: existing.id,
          })),
        });
      }
      return tx.itinerary.update({
        where: { id: existing.id },
        data: rest,
        include: itineraryInclude,
      });
    });

    res.json({ itinerary: serializeItinerary(itinerary) });
  }),
);

itinerariesRouter.post(
  '/:id/duplicate',
  asyncHandler(async (req, res) => {
    const source = await ownedItinerary(req.params.id, req.auth!.userId);

    const copy = await prisma.itinerary.create({
      data: {
        userId: req.auth!.userId,
        title: `${source.title} (copy)`,
        cityId: source.cityId,
        startLabel: source.startLabel,
        startLatitude: source.startLatitude,
        startLongitude: source.startLongitude,
        endLatitude: source.endLatitude,
        endLongitude: source.endLongitude,
        availableMinutes: source.availableMinutes,
        travelMode: source.travelMode,
        totalTravelMinutes: source.totalTravelMinutes,
        totalVisitMinutes: source.totalVisitMinutes,
        totalDistanceMeters: source.totalDistanceMeters,
        bufferMinutes: source.bufferMinutes,
        status: 'PLANNED',
        stops: {
          create: source.stops.map((stop) => ({
            placeId: stop.placeId,
            order: stop.order,
            estimatedArrivalOffsetMinutes: stop.estimatedArrivalOffsetMinutes,
            estimatedVisitDurationMinutes: stop.estimatedVisitDurationMinutes,
            travelTimeFromPreviousMinutes: stop.travelTimeFromPreviousMinutes,
            distanceFromPreviousMeters: stop.distanceFromPreviousMeters,
          })),
        },
      },
      include: itineraryInclude,
    });

    res.status(201).json({ itinerary: serializeItinerary(copy) });
  }),
);

/** Journey progress: mark a stop done, or start/finish the whole trip. */
itinerariesRouter.patch(
  '/:id/stops/:stopId',
  validate(z.object({ completed: z.boolean() })),
  asyncHandler(async (req, res) => {
    const itinerary = await ownedItinerary(req.params.id, req.auth!.userId);
    const stop = itinerary.stops.find((entry) => entry.id === req.params.stopId);
    if (!stop) throw notFound('Stop not found');

    await prisma.itineraryStop.update({
      where: { id: stop.id },
      data: { completedAt: req.body.completed ? new Date() : null },
    });

    const refreshed = await ownedItinerary(itinerary.id, req.auth!.userId);
    const allDone = refreshed.stops.every((entry) => entry.completedAt !== null);

    await prisma.itinerary.update({
      where: { id: itinerary.id },
      data: {
        status: allDone ? 'COMPLETED' : 'IN_PROGRESS',
        startedAt: itinerary.startedAt ?? new Date(),
        completedAt: allDone ? new Date() : null,
      },
    });

    res.json({ itinerary: serializeItinerary(await ownedItinerary(itinerary.id, req.auth!.userId)) });
  }),
);

itinerariesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await ownedItinerary(req.params.id, req.auth!.userId);
    await prisma.itinerary.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);
