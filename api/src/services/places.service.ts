import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { haversineMeters, type LatLng } from '../lib/geo.js';

export const placeInclude = {
  country: { select: { id: true, name: true, code: true } },
  city: { select: { id: true, name: true, latitude: true, longitude: true } },
  primaryCategory: { select: { id: true, key: true, name: true, icon: true, colorHex: true } },
  categories: {
    include: { category: { select: { id: true, key: true, name: true, icon: true, colorHex: true } } },
  },
  photos: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
  openingHours: { orderBy: { dayOfWeek: 'asc' } },
} satisfies Prisma.PlaceInclude;

export type PlaceWithRelations = Prisma.PlaceGetPayload<{ include: typeof placeInclude }>;

export interface SerializeOptions {
  origin?: LatLng | null;
  savedPlaceIds?: Set<string>;
}

export function serializePlace(place: PlaceWithRelations, options: SerializeOptions = {}) {
  const distanceMeters = options.origin
    ? Math.round(
        haversineMeters(options.origin, { latitude: place.latitude, longitude: place.longitude }),
      )
    : null;

  return {
    id: place.id,
    name: place.name,
    slug: place.slug,
    shortDescription: place.shortDescription,
    description: place.description,
    latitude: place.latitude,
    longitude: place.longitude,
    estimatedVisitDurationMinutes: place.estimatedVisitDurationMinutes,
    importanceScore: place.importanceScore,
    status: place.status,
    address: place.address,
    website: place.website,
    historicalPeriod: place.historicalPeriod,
    religiousSignificance: place.religiousSignificance,
    country: place.country,
    city: place.city,
    primaryCategory: place.primaryCategory,
    categories: place.categories.map((link) => link.category),
    photos: place.photos.map((photo) => ({
      id: photo.id,
      url: photo.url,
      thumbnailUrl: photo.thumbnailUrl,
      caption: photo.caption,
      isPrimary: photo.isPrimary,
      sortOrder: photo.sortOrder,
    })),
    primaryPhotoUrl: place.photos.find((p) => p.isPrimary)?.url ?? place.photos[0]?.url ?? null,
    openingHours: place.openingHours.map((hour) => ({
      dayOfWeek: hour.dayOfWeek,
      opensMinutes: hour.opensMinutes,
      closesMinutes: hour.closesMinutes,
      isClosed: hour.isClosed,
    })),
    distanceMeters,
    isSaved: options.savedPlaceIds ? options.savedPlaceIds.has(place.id) : undefined,
    createdAt: place.createdAt,
    updatedAt: place.updatedAt,
  };
}

export async function savedPlaceIdsFor(userId: string | undefined): Promise<Set<string>> {
  if (!userId) return new Set();
  const rows = await prisma.savedPlace.findMany({
    where: { userId },
    select: { placeId: true },
  });
  return new Set(rows.map((row) => row.placeId));
}

/** Turns a `slug`-able name into a URL-safe, transliteration-friendly slug. */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export async function uniquePlaceSlug(cityId: string, name: string, excludeId?: string) {
  const base = slugify(name) || 'place';
  let slug = base;
  let suffix = 2;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.place.findFirst({
      where: { cityId, slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (!existing) return slug;
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
}
