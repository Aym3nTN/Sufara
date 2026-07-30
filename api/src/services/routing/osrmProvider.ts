import type { LatLng } from '../../lib/geo.js';
import type { TravelMode } from '../../domain/constants.js';
import type { RoutingProvider, RouteGeometry, TravelLeg } from './types.js';
import { HaversineRoutingProvider } from './haversineProvider.js';

const OSRM_PROFILE: Record<TravelMode, string> = {
  WALKING: 'foot',
  DRIVING: 'driving',
};

const coord = (p: LatLng) => `${p.longitude},${p.latitude}`;

/**
 * Road-network routing through an OSRM server.
 *
 * Demonstrates that a real provider drops into the `RoutingProvider` contract
 * with no planner change. Any network/quota failure degrades to the offline
 * estimator rather than failing a user's trip planning.
 */
export class OsrmRoutingProvider implements RoutingProvider {
  readonly name = 'osrm';

  private readonly fallback = new HaversineRoutingProvider();

  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 6_000,
  ) {}

  async getTravelLeg(origin: LatLng, destination: LatLng, mode: TravelMode): Promise<TravelLeg> {
    const matrix = await this.getTravelMatrix([origin, destination], mode);
    return matrix[0]![1]!;
  }

  async getTravelMatrix(points: LatLng[], mode: TravelMode): Promise<TravelLeg[][]> {
    if (points.length < 2) return [[{ distanceMeters: 0, durationMinutes: 0 }]];

    try {
      const path = points.map(coord).join(';');
      const url = `${this.baseUrl}/table/v1/${OSRM_PROFILE[mode]}/${path}?annotations=duration,distance`;
      const data = await this.fetchJson<{
        code: string;
        durations: number[][];
        distances: number[][];
      }>(url);

      if (data.code !== 'Ok') throw new Error(`OSRM table returned ${data.code}`);

      return data.durations.map((row, i) =>
        row.map((seconds, j) => ({
          distanceMeters: Math.round(data.distances?.[i]?.[j] ?? 0),
          durationMinutes: i === j ? 0 : Math.max(1, Math.round(seconds / 60)),
        })),
      );
    } catch {
      return this.fallback.getTravelMatrix(points, mode);
    }
  }

  async getRouteGeometry(
    origin: LatLng,
    waypoints: LatLng[],
    mode: TravelMode,
  ): Promise<RouteGeometry> {
    const points = [origin, ...waypoints];

    try {
      const path = points.map(coord).join(';');
      const url = `${this.baseUrl}/route/v1/${OSRM_PROFILE[mode]}/${path}?overview=full&geometries=geojson&steps=false`;
      const data = await this.fetchJson<{
        code: string;
        routes: Array<{
          distance: number;
          duration: number;
          geometry: { coordinates: [number, number][] };
          legs: Array<{ distance: number; duration: number }>;
        }>;
      }>(url);

      const route = data.routes?.[0];
      if (data.code !== 'Ok' || !route) throw new Error(`OSRM route returned ${data.code}`);

      return {
        coordinates: route.geometry.coordinates.map(([longitude, latitude]) => ({
          latitude,
          longitude,
        })),
        distanceMeters: Math.round(route.distance),
        durationMinutes: Math.max(1, Math.round(route.duration / 60)),
        legs: route.legs.map((leg) => ({
          distanceMeters: Math.round(leg.distance),
          durationMinutes: Math.max(1, Math.round(leg.duration / 60)),
        })),
      };
    } catch {
      return this.fallback.getRouteGeometry(origin, waypoints, mode);
    }
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`OSRM responded ${response.status}`);
      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}
