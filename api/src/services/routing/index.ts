import { env } from '../../config/env.js';
import { HaversineRoutingProvider } from './haversineProvider.js';
import { OsrmRoutingProvider } from './osrmProvider.js';
import type { RoutingProvider } from './types.js';

export * from './types.js';
export { HaversineRoutingProvider } from './haversineProvider.js';
export { OsrmRoutingProvider } from './osrmProvider.js';

let instance: RoutingProvider | null = null;

export function getRoutingProvider(): RoutingProvider {
  if (!instance) {
    instance =
      env.ROUTING_PROVIDER === 'osrm'
        ? new OsrmRoutingProvider(env.OSRM_BASE_URL)
        : new HaversineRoutingProvider();
  }
  return instance;
}

/** Test seam: lets suites inject a deterministic or spy provider. */
export function setRoutingProvider(provider: RoutingProvider | null): void {
  instance = provider;
}
