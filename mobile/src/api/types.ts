/** API contract types, mirroring the serialisers in `api/src`. */

export type Role = 'USER' | 'ADMIN';
export type TravelMode = 'WALKING' | 'DRIVING';
export type WalkingTolerance = 'LOW' | 'MEDIUM' | 'HIGH';
export type PlaceStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';
export type ItineraryStatus = 'DRAFT' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl: string | null;
  createdAt: string;
}

export interface Category {
  id: string;
  key: string;
  name: string;
  icon: string;
  colorHex: string;
  sortOrder?: number;
  isActive?: boolean;
  placeCount?: number;
}

export interface Country {
  id: string;
  name: string;
  code: string;
  slug: string;
  cityCount?: number;
  placeCount?: number;
  isActive?: boolean;
}

export interface City {
  id: string;
  name: string;
  slug: string;
  latitude: number;
  longitude: number;
  timezone: string;
  heroImageUrl: string | null;
  country: Pick<Country, 'id' | 'name' | 'code'>;
  placeCount: number;
}

export interface Photo {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  caption: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

export interface OpeningHour {
  dayOfWeek: number;
  opensMinutes: number;
  closesMinutes: number;
  isClosed: boolean;
}

export interface Place {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  latitude: number;
  longitude: number;
  estimatedVisitDurationMinutes: number;
  importanceScore: number;
  status: PlaceStatus;
  address: string | null;
  website: string | null;
  historicalPeriod: string | null;
  religiousSignificance: string | null;
  country: Pick<Country, 'id' | 'name' | 'code'>;
  city: { id: string; name: string; latitude: number; longitude: number };
  primaryCategory: Category;
  categories: Category[];
  photos: Photo[];
  primaryPhotoUrl: string | null;
  openingHours: OpeningHour[];
  distanceMeters: number | null;
  isSaved?: boolean;
}

export interface PlanStop {
  order: number;
  place: Place;
  estimatedArrivalOffsetMinutes: number;
  estimatedVisitDurationMinutes: number;
  travelTimeFromPreviousMinutes: number;
  distanceFromPreviousMeters: number;
}

export interface PlanTotals {
  travelMinutes: number;
  visitMinutes: number;
  totalMinutes: number;
  distanceMeters: number;
  bufferMinutes: number;
  targetBufferMinutes: number;
  overBudgetMinutes: number;
}

export interface Plan {
  start: LatLng & { label: string };
  end: LatLng | null;
  cityId: string | null;
  travelMode: TravelMode;
  availableMinutes: number;
  stops: PlanStop[];
  totals: PlanTotals;
  route: { coordinates: LatLng[]; distanceMeters: number; durationMinutes: number };
  notes: string[];
  warnings: string[];
  dropped: Array<{ placeId: string; name: string; reason: 'NO_TIME' | 'CLOSED' | 'TOO_FAR' }>;
}

export interface ItineraryStop {
  id: string;
  order: number;
  estimatedArrivalOffsetMinutes: number;
  estimatedVisitDurationMinutes: number;
  travelTimeFromPreviousMinutes: number;
  distanceFromPreviousMeters: number;
  completedAt: string | null;
  place: Place;
}

export interface Itinerary {
  id: string;
  title: string;
  cityId: string | null;
  cityName: string | null;
  status: ItineraryStatus;
  travelMode: TravelMode;
  availableMinutes: number;
  start: LatLng & { label: string };
  end: LatLng | null;
  totals: Omit<PlanTotals, 'targetBufferMinutes' | 'overBudgetMinutes'>;
  stops: ItineraryStop[];
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Preferences {
  travelMode: TravelMode;
  walkingTolerance: WalkingTolerance;
  maxWalkingMeters: number;
  interestCategoryIds: string[];
  interests: Category[];
}

export interface Profile {
  user: User;
  preferences: Preferences;
  stats: { trips: number; savedPlaces: number; placesVisited: number };
}

export interface AdminStats {
  totals: {
    places: number;
    countries: number;
    cities: number;
    users: number;
    placesAwaitingReview: number;
  };
  recentPlaces: Array<{
    id: string;
    name: string;
    cityName: string;
    categoryName: string;
    status: PlaceStatus;
    createdAt: string;
  }>;
  recentUsers: User[];
  placesByCategory: Array<{ id: string; name: string; count: number }>;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PlanRequest {
  cityId?: string;
  start: LatLng;
  startLabel?: string;
  end?: LatLng;
  availableMinutes: number;
  travelMode?: TravelMode;
  interestCategoryIds?: string[];
  selectedPlaceIds?: string[];
  maxPlaces?: number;
  walkingTolerance?: WalkingTolerance;
  maxWalkingMeters?: number;
  startTime?: string;
}
