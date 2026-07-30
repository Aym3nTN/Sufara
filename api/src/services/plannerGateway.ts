import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { badRequest, notFound } from '../lib/errors.js';
import type { LatLng } from '../lib/geo.js';
import { boundingBox, haversineMeters } from '../lib/geo.js';
import { WALKING_TOLERANCE_METERS, type TravelMode, type WalkingTolerance } from '../domain/constants.js';
import { getRoutingProvider } from './routing/index.js';
import { planVisit, type PlanResult, type PlannerCandidate, type PlannerClock } from './planner/index.js';
import { placeInclude, serializePlace, type PlaceWithRelations } from './places.service.js';

const MAX_CANDIDATES = 60;
const CITY_FALLBACK_RADIUS_METERS = 60_000;

export interface PlanCommand {
  userId?: string;
  cityId?: string;
  start: LatLng;
  startLabel?: string;
  end?: LatLng;
  availableMinutes: number;
  /** Omitted means "use my saved preference"; resolved before planning. */
  travelMode?: TravelMode;
  interestCategoryIds?: string[];
  selectedPlaceIds?: string[];
  maxPlaces?: number;
  walkingTolerance?: WalkingTolerance;
  maxWalkingMeters?: number;
  startTime?: string;
  /** Keep the given order of `selectedPlaceIds` instead of optimising it. */
  preserveOrder?: boolean;
}

/** Local wall-clock day/minute in a city's timezone, for opening-hours checks. */
export function localClock(date: Date, timeZone: string): PlannerClock {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '0';

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayOfWeek = Math.max(0, weekdays.indexOf(lookup('weekday')));
  const hour = Number(lookup('hour')) % 24;
  const minute = Number(lookup('minute'));

  return { dayOfWeek, minutesOfDay: hour * 60 + minute };
}

function toCandidate(place: PlaceWithRelations): PlannerCandidate {
  return {
    id: place.id,
    name: place.name,
    latitude: place.latitude,
    longitude: place.longitude,
    importanceScore: place.importanceScore,
    estimatedVisitDurationMinutes: place.estimatedVisitDurationMinutes,
    categoryIds: place.categories.map((link) => link.categoryId),
    openingHours: place.openingHours.map((hour) => ({
      dayOfWeek: hour.dayOfWeek,
      opensMinutes: hour.opensMinutes,
      closesMinutes: hour.closesMinutes,
      isClosed: hour.isClosed,
    })),
  };
}

async function loadCandidates(command: PlanCommand): Promise<{
  places: PlaceWithRelations[];
  timezone: string;
}> {
  const selected = command.selectedPlaceIds ?? [];

  const required = selected.length
    ? await prisma.place.findMany({ where: { id: { in: selected } }, include: placeInclude })
    : [];

  if (selected.length > 0 && required.length !== new Set(selected).size) {
    throw notFound('One or more of the selected places could not be found');
  }

  let timezone = 'UTC';
  let pool: PlaceWithRelations[] = [];

  if (command.cityId) {
    const city = await prisma.city.findFirst({ where: { id: command.cityId, isActive: true } });
    if (!city) throw notFound('City not found');
    timezone = city.timezone;

    pool = await prisma.place.findMany({
      where: { cityId: city.id, status: 'ACTIVE' },
      include: placeInclude,
      orderBy: { importanceScore: 'desc' },
      take: MAX_CANDIDATES,
    });
  } else if (!command.preserveOrder) {
    // No city given: fall back to a radius around the starting point.
    const box = boundingBox(command.start, CITY_FALLBACK_RADIUS_METERS);
    const nearby = await prisma.place.findMany({
      where: {
        status: 'ACTIVE',
        latitude: { gte: box.minLatitude, lte: box.maxLatitude },
        longitude: { gte: box.minLongitude, lte: box.maxLongitude },
      },
      include: placeInclude,
    });
    pool = nearby
      .filter(
        (place) =>
          haversineMeters(command.start, {
            latitude: place.latitude,
            longitude: place.longitude,
          }) <= CITY_FALLBACK_RADIUS_METERS,
      )
      .sort((a, b) => b.importanceScore - a.importanceScore)
      .slice(0, MAX_CANDIDATES);

    timezone = pool[0]?.city ? (await cityTimezone(pool[0].cityId)) : 'UTC';
  }

  if (required.length > 0 && command.cityId === undefined) {
    timezone = await cityTimezone(required[0]!.cityId);
  }

  const byId = new Map<string, PlaceWithRelations>();
  for (const place of [...required, ...pool]) byId.set(place.id, place);

  return { places: [...byId.values()], timezone };
}

async function cityTimezone(cityId: string): Promise<string> {
  const city = await prisma.city.findUnique({ where: { id: cityId }, select: { timezone: true } });
  return city?.timezone ?? 'UTC';
}

/** A command with every optional preference filled in. */
type ResolvedPlanCommand = PlanCommand & { travelMode: TravelMode };

async function resolveDefaults(command: PlanCommand): Promise<ResolvedPlanCommand> {
  if (!command.userId) {
    return { ...command, travelMode: command.travelMode ?? 'DRIVING' };
  }

  const [preference, interests] = await Promise.all([
    prisma.userPreference.findUnique({ where: { userId: command.userId } }),
    prisma.userInterest.findMany({ where: { userId: command.userId }, select: { categoryId: true } }),
  ]);

  return {
    ...command,
    travelMode: command.travelMode ?? (preference?.travelMode as TravelMode) ?? 'DRIVING',
    walkingTolerance:
      command.walkingTolerance ?? (preference?.walkingTolerance as WalkingTolerance) ?? 'MEDIUM',
    maxWalkingMeters: command.maxWalkingMeters ?? preference?.maxWalkingMeters,
    interestCategoryIds:
      command.interestCategoryIds && command.interestCategoryIds.length > 0
        ? command.interestCategoryIds
        : interests.map((i) => i.categoryId),
  };
}

export interface SerializedPlan {
  start: { latitude: number; longitude: number; label: string };
  end: { latitude: number; longitude: number } | null;
  cityId: string | null;
  travelMode: TravelMode;
  availableMinutes: number;
  stops: Array<{
    order: number;
    place: ReturnType<typeof serializePlace>;
    estimatedArrivalOffsetMinutes: number;
    estimatedVisitDurationMinutes: number;
    travelTimeFromPreviousMinutes: number;
    distanceFromPreviousMeters: number;
  }>;
  totals: {
    travelMinutes: number;
    visitMinutes: number;
    totalMinutes: number;
    distanceMeters: number;
    bufferMinutes: number;
    targetBufferMinutes: number;
    overBudgetMinutes: number;
  };
  route: { coordinates: LatLng[]; distanceMeters: number; durationMinutes: number };
  notes: string[];
  warnings: string[];
  dropped: PlanResult['dropped'];
}

export async function buildPlan(input: PlanCommand): Promise<SerializedPlan> {
  const command = await resolveDefaults(input);
  const routing = getRoutingProvider();
  const { places, timezone } = await loadCandidates(command);

  if (places.length === 0) {
    throw badRequest('There are no places available to plan a visit around yet');
  }

  const maxLegMeters =
    command.travelMode === 'WALKING'
      ? command.maxWalkingMeters ??
        WALKING_TOLERANCE_METERS[command.walkingTolerance ?? 'MEDIUM']
      : undefined;

  const clock = localClock(
    command.startTime ? new Date(command.startTime) : new Date(),
    timezone,
  );

  const candidates = places.map(toCandidate);
  const placeById = new Map(places.map((place) => [place.id, place]));

  const plan = command.preserveOrder
    ? await evaluateFixedOrder(command, candidates, routing)
    : await planVisit(
        {
          start: command.start,
          end: command.end,
          availableMinutes: command.availableMinutes,
          travelMode: command.travelMode,
          candidates,
          interestCategoryIds: command.interestCategoryIds,
          requiredPlaceIds: command.selectedPlaceIds,
          maxPlaces: command.maxPlaces,
          maxLegMeters,
          clock,
          buffer: {
            ratio: env.PLANNER_BUFFER_RATIO,
            minMinutes: env.PLANNER_MIN_BUFFER_MINUTES,
            maxMinutes: env.PLANNER_MAX_BUFFER_MINUTES,
          },
        },
        routing,
      );

  const geometry = await routing.getRouteGeometry(
    command.start,
    [
      ...plan.stops.map((stop) => {
        const place = placeById.get(stop.placeId)!;
        return { latitude: place.latitude, longitude: place.longitude };
      }),
      ...(command.end ? [command.end] : []),
    ],
    command.travelMode,
  );

  const warnings: string[] = [];
  if (plan.overBudgetMinutes > 0) {
    warnings.push(
      `This visit runs about ${plan.overBudgetMinutes} minutes longer than the ${command.availableMinutes} minutes you have.`,
    );
  }
  const droppedForTime = plan.dropped.filter((d) => d.reason === 'NO_TIME');
  if (droppedForTime.length > 0 && plan.stops.length > 0) {
    warnings.push(
      `${droppedForTime.length} more ${
        droppedForTime.length === 1 ? 'place' : 'places'
      } nearby did not fit in your available time.`,
    );
  }
  for (const closed of plan.dropped.filter((d) => d.reason === 'CLOSED')) {
    warnings.push(`${closed.name} is closed at that time, so it was left out.`);
  }

  return {
    start: {
      latitude: command.start.latitude,
      longitude: command.start.longitude,
      label: command.startLabel ?? 'Your current location',
    },
    end: command.end ?? null,
    cityId: command.cityId ?? null,
    travelMode: command.travelMode,
    availableMinutes: command.availableMinutes,
    stops: plan.stops.map((stop) => ({
      order: stop.order,
      place: serializePlace(placeById.get(stop.placeId)!, { origin: command.start }),
      estimatedArrivalOffsetMinutes: stop.estimatedArrivalOffsetMinutes,
      estimatedVisitDurationMinutes: stop.estimatedVisitDurationMinutes,
      travelTimeFromPreviousMinutes: stop.travelTimeFromPreviousMinutes,
      distanceFromPreviousMeters: stop.distanceFromPreviousMeters,
    })),
    totals: {
      travelMinutes: plan.totalTravelMinutes,
      visitMinutes: plan.totalVisitMinutes,
      totalMinutes: plan.totalMinutes,
      distanceMeters: plan.totalDistanceMeters,
      bufferMinutes: plan.bufferMinutes,
      targetBufferMinutes: plan.targetBufferMinutes,
      overBudgetMinutes: plan.overBudgetMinutes,
    },
    route: {
      coordinates: geometry.coordinates,
      distanceMeters: geometry.distanceMeters,
      durationMinutes: geometry.durationMinutes,
    },
    notes: plan.notes,
    warnings,
    dropped: plan.dropped,
  };
}

/**
 * Times a traveller-chosen order exactly as given — used by the itinerary
 * editor so it can warn "adding this stop puts you 35 minutes over" without
 * silently reshuffling what the traveller arranged.
 */
async function evaluateFixedOrder(
  command: ResolvedPlanCommand,
  candidates: PlannerCandidate[],
  routing: ReturnType<typeof getRoutingProvider>,
): Promise<PlanResult> {
  const ordered = (command.selectedPlaceIds ?? [])
    .map((id) => candidates.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is PlannerCandidate => Boolean(candidate));

  const points: LatLng[] = [
    command.start,
    ...ordered.map((c) => ({ latitude: c.latitude, longitude: c.longitude })),
    ...(command.end ? [command.end] : []),
  ];

  let travelMinutes = 0;
  let visitMinutes = 0;
  let distanceMeters = 0;
  const stops = [];

  for (let i = 0; i < ordered.length; i += 1) {
    const leg = await routing.getTravelLeg(points[i]!, points[i + 1]!, command.travelMode);
    travelMinutes += leg.durationMinutes;
    distanceMeters += leg.distanceMeters;

    stops.push({
      placeId: ordered[i]!.id,
      order: i + 1,
      estimatedArrivalOffsetMinutes: travelMinutes + visitMinutes,
      estimatedVisitDurationMinutes: ordered[i]!.estimatedVisitDurationMinutes,
      travelTimeFromPreviousMinutes: leg.durationMinutes,
      distanceFromPreviousMeters: leg.distanceMeters,
    });

    visitMinutes += ordered[i]!.estimatedVisitDurationMinutes;
  }

  if (command.end && ordered.length > 0) {
    const leg = await routing.getTravelLeg(
      points[points.length - 2]!,
      points[points.length - 1]!,
      command.travelMode,
    );
    travelMinutes += leg.durationMinutes;
    distanceMeters += leg.distanceMeters;
  }

  const totalMinutes = travelMinutes + visitMinutes;

  return {
    stops,
    totalTravelMinutes: travelMinutes,
    totalVisitMinutes: visitMinutes,
    totalMinutes,
    totalDistanceMeters: distanceMeters,
    bufferMinutes: command.availableMinutes - totalMinutes,
    targetBufferMinutes: 0,
    overBudgetMinutes: Math.max(0, totalMinutes - command.availableMinutes),
    dropped: [],
    notes: [`${ordered.length} stops in the order you arranged.`],
  };
}
