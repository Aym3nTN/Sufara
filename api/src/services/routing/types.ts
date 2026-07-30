import type { LatLng } from '../../lib/geo.js';
import type { TravelMode } from '../../domain/constants.js';

export interface TravelLeg {
  distanceMeters: number;
  durationMinutes: number;
}

export interface RouteGeometry {
  /** Ordered coordinates that draw the route on a map. */
  coordinates: LatLng[];
  distanceMeters: number;
  durationMinutes: number;
  /** Per-leg breakdown, `legs[i]` connects waypoint i to waypoint i+1. */
  legs: TravelLeg[];
}

/**
 * Every routing implementation (haversine estimate, OSRM, ORS, Mapbox, Google)
 * satisfies this contract. Nothing outside `services/routing` may know which
 * one is in use.
 */
export interface RoutingProvider {
  readonly name: string;

  getTravelLeg(origin: LatLng, destination: LatLng, mode: TravelMode): Promise<TravelLeg>;

  /** Full n x n matrix. `matrix[i][j]` is the leg from points[i] to points[j]. */
  getTravelMatrix(points: LatLng[], mode: TravelMode): Promise<TravelLeg[][]>;

  getRouteGeometry(origin: LatLng, waypoints: LatLng[], mode: TravelMode): Promise<RouteGeometry>;
}
