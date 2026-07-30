export const ROLES = ['USER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const TRAVEL_MODES = ['WALKING', 'DRIVING'] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];

export const WALKING_TOLERANCES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type WalkingTolerance = (typeof WALKING_TOLERANCES)[number];

export const PLACE_STATUSES = ['DRAFT', 'ACTIVE', 'INACTIVE'] as const;
export type PlaceStatus = (typeof PLACE_STATUSES)[number];

export const ITINERARY_STATUSES = ['DRAFT', 'PLANNED', 'IN_PROGRESS', 'COMPLETED'] as const;
export type ItineraryStatus = (typeof ITINERARY_STATUSES)[number];

/** Seeded category keys. Categories themselves are admin-managed rows. */
export const CATEGORY_KEYS = [
  'MOSQUE',
  'HISTORICAL_SITE',
  'SHRINE_TOMB',
  'BATTLE_SITE',
  'MONUMENT',
  'MUSEUM',
  'RELIGIOUS_LANDMARK',
  'OTHER',
] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];

/** Walking tolerance -> maximum leg distance the planner will accept on foot. */
export const WALKING_TOLERANCE_METERS: Record<WalkingTolerance, number> = {
  LOW: 1_200,
  MEDIUM: 2_500,
  HIGH: 5_000,
};
