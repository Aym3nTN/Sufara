import { haversineMeters, type LatLng } from '../../lib/geo.js';
import type { TravelMode } from '../../domain/constants.js';
import type { RoutingProvider, RouteGeometry, TravelLeg } from './types.js';

/**
 * Offline travel-time estimator used for the MVP.
 *
 * Straight-line distance is multiplied by a mode-specific detour factor to
 * approximate the road/footpath network, divided by an average urban speed,
 * then a fixed per-stop overhead is added (parking and walking from the car,
 * finding the entrance on foot). No API key, no quota — accurate enough to
 * prove the product, and replaceable without touching the planner.
 */
const PROFILE: Record<TravelMode, { detourFactor: number; kmh: number; overheadMinutes: number }> = {
  WALKING: { detourFactor: 1.25, kmh: 4.8, overheadMinutes: 2 },
  DRIVING: { detourFactor: 1.35, kmh: 30, overheadMinutes: 5 },
};

export class HaversineRoutingProvider implements RoutingProvider {
  readonly name = 'haversine';

  async getTravelLeg(origin: LatLng, destination: LatLng, mode: TravelMode): Promise<TravelLeg> {
    return this.estimate(origin, destination, mode);
  }

  async getTravelMatrix(points: LatLng[], mode: TravelMode): Promise<TravelLeg[][]> {
    return points.map((from) => points.map((to) => this.estimate(from, to, mode)));
  }

  async getRouteGeometry(
    origin: LatLng,
    waypoints: LatLng[],
    mode: TravelMode,
  ): Promise<RouteGeometry> {
    const points = [origin, ...waypoints];
    const legs: TravelLeg[] = [];

    for (let i = 0; i < points.length - 1; i += 1) {
      legs.push(this.estimate(points[i]!, points[i + 1]!, mode));
    }

    return {
      coordinates: points,
      distanceMeters: legs.reduce((sum, leg) => sum + leg.distanceMeters, 0),
      durationMinutes: legs.reduce((sum, leg) => sum + leg.durationMinutes, 0),
      legs,
    };
  }

  private estimate(origin: LatLng, destination: LatLng, mode: TravelMode): TravelLeg {
    const profile = PROFILE[mode];
    const straight = haversineMeters(origin, destination);

    if (straight < 1) {
      return { distanceMeters: 0, durationMinutes: 0 };
    }

    const distanceMeters = straight * profile.detourFactor;
    const minutes = (distanceMeters / 1000 / profile.kmh) * 60 + profile.overheadMinutes;

    return {
      distanceMeters: Math.round(distanceMeters),
      durationMinutes: Math.max(1, Math.round(minutes)),
    };
  }
}
