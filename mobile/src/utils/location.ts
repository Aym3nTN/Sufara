import * as Location from 'expo-location';
import type { LatLng } from '../api/types';

export interface ResolvedLocation extends LatLng {
  label: string;
  /** False when permission was denied or the fix failed and a fallback is used. */
  precise: boolean;
}

/**
 * Asks for foreground location once and returns a usable starting point.
 * A denial is not an error path for the product: planning still works from a
 * city centre, so the caller always gets coordinates back.
 */
export async function resolveCurrentLocation(fallback?: LatLng & { label?: string }): Promise<ResolvedLocation | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const position =
        (await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 })) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));

      if (position) {
        return {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          label: 'Your current location',
          precise: true,
        };
      }
    }
  } catch {
    // Fall through to the fallback below.
  }

  if (!fallback) return null;
  return {
    latitude: fallback.latitude,
    longitude: fallback.longitude,
    label: fallback.label ?? 'Chosen starting point',
    precise: false,
  };
}

/** Opens the platform maps app for turn-by-turn navigation to a stop. */
export function externalNavigationUrl(destination: LatLng, mode: 'WALKING' | 'DRIVING'): string {
  const travelmode = mode === 'WALKING' ? 'walking' : 'driving';
  return `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}&travelmode=${travelmode}`;
}
