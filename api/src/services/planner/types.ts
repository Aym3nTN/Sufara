import type { LatLng } from '../../lib/geo.js';
import type { TravelMode } from '../../domain/constants.js';

export interface PlannerOpeningHour {
  dayOfWeek: number;
  opensMinutes: number;
  closesMinutes: number;
  isClosed: boolean;
}

/** The shape the planner needs from a place. Deliberately not a Prisma model. */
export interface PlannerCandidate {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  /** 1..100, admin-managed. */
  importanceScore: number;
  estimatedVisitDurationMinutes: number;
  categoryIds: string[];
  openingHours?: PlannerOpeningHour[];
}

export interface PlannerClock {
  /** 0 = Sunday .. 6 = Saturday, in the destination city's local time. */
  dayOfWeek: number;
  /** Minutes since local midnight at the moment the visit starts. */
  minutesOfDay: number;
}

export interface PlanRequest {
  start: LatLng;
  end?: LatLng;
  availableMinutes: number;
  travelMode: TravelMode;
  candidates: PlannerCandidate[];
  /** Interest categories bias scoring; they never hard-filter. */
  interestCategoryIds?: string[];
  /** Mode B: these places must appear in the result, even if they overflow. */
  requiredPlaceIds?: string[];
  maxPlaces?: number;
  /** Longest single leg accepted, derived from walking tolerance. */
  maxLegMeters?: number;
  clock?: PlannerClock;
  buffer?: BufferConfig;
}

export interface BufferConfig {
  ratio: number;
  minMinutes: number;
  maxMinutes: number;
}

export interface PlanStop {
  placeId: string;
  order: number;
  estimatedArrivalOffsetMinutes: number;
  estimatedVisitDurationMinutes: number;
  travelTimeFromPreviousMinutes: number;
  distanceFromPreviousMeters: number;
}

export interface DroppedPlace {
  placeId: string;
  name: string;
  reason: 'NO_TIME' | 'CLOSED' | 'TOO_FAR';
}

export interface PlanResult {
  stops: PlanStop[];
  totalTravelMinutes: number;
  totalVisitMinutes: number;
  totalMinutes: number;
  totalDistanceMeters: number;
  /** Slack left over: availableMinutes - totalMinutes. Negative only in Mode B. */
  bufferMinutes: number;
  targetBufferMinutes: number;
  /** Minutes by which required places push past the available time (Mode B). */
  overBudgetMinutes: number;
  dropped: DroppedPlace[];
  /** Human-readable justification for the "Why these places?" panel. */
  notes: string[];
}
