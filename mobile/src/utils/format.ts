import type { OpeningHour } from '../api/types';

export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—';
  const value = Math.max(0, Math.round(minutes));
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${String(rest).padStart(2, '0')}m`;
}

export function formatDistance(meters: number | null | undefined): string {
  if (meters === null || meters === undefined) return '—';
  if (meters < 950) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** Wall-clock time for an offset from "now", used on itinerary timelines. */
export function clockAfter(offsetMinutes: number, from = new Date()): string {
  const date = new Date(from.getTime() + offsetMinutes * 60_000);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function formatOpeningHours(hours: OpeningHour[]): string {
  if (hours.length === 0) return '24 hours';
  const today = hours.find((hour) => hour.dayOfWeek === new Date().getDay());
  if (!today) return 'See details';
  if (today.isClosed) return `Closed ${DAYS[today.dayOfWeek]}`;
  return `${minutesToClock(today.opensMinutes)} – ${minutesToClock(today.closesMinutes)}`;
}

export function minutesToClock(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const rest = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export const TIME_PRESETS = [
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: '4 hours', minutes: 240 },
  { label: 'Half day', minutes: 360 },
  { label: 'Full day', minutes: 600 },
] as const;

/** Emoji glyph per category key — pins and chips read at a glance. */
export function categoryGlyph(key: string): string {
  switch (key) {
    case 'MOSQUE':
      return '🕌';
    case 'HISTORICAL_SITE':
      return '🏛';
    case 'SHRINE_TOMB':
      return '🕋';
    case 'BATTLE_SITE':
      return '⚔️';
    case 'MONUMENT':
      return '🗿';
    case 'MUSEUM':
      return '🏺';
    case 'RELIGIOUS_LANDMARK':
      return '✨';
    default:
      return '📍';
  }
}
