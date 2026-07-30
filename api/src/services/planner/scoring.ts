import type { PlannerCandidate, PlannerClock } from './types.js';

/**
 * How strongly extra minutes are penalised when comparing candidates.
 *
 * A value of 1 would mean "pure value per minute", which always prefers the
 * nearest cheap stop. Below 1 the penalty grows sub-linearly, so a highly
 * significant site that costs a few more minutes of travel can still win —
 * which is exactly the behaviour the product requires.
 */
export const TIME_SENSITIVITY = 0.6;

/**
 * Significance is treated as super-linear in `importanceScore`.
 *
 * A linear reading makes two minor mosques worth more than al-Masjid an-Nabawi,
 * which is not how a traveller with three hours in Madinah experiences the
 * choice. Raising the score to a power above 1 lets first-rank sites dominate
 * while leaving the ordering of the rest intact. The judgement stays in the
 * admin-managed `importanceScore` column; only its curve lives here.
 */
export const SIGNIFICANCE_EXPONENT = 2.2;

/**
 * Weight applied to places outside the traveller's stated interests. Above zero
 * on purpose: a narrow filter must never produce an empty itinerary in a city
 * full of significant sites.
 */
export const OFF_INTEREST_WEIGHT = 0.4;

/** Score a candidate on usefulness alone, independent of where it sits. */
export function valueOf(candidate: PlannerCandidate, interestCategoryIds: string[]): number {
  const significance = Math.pow(clamp01(candidate.importanceScore / 100), SIGNIFICANCE_EXPONENT);

  // No stated interests means everything is equally welcome.
  if (interestCategoryIds.length === 0) return significance;

  const matches = candidate.categoryIds.some((id) => interestCategoryIds.includes(id));
  return significance * (matches ? 1 : OFF_INTEREST_WEIGHT);
}

/** Value per marginal minute, with a sub-linear time penalty. */
export function marginalRatio(value: number, marginalMinutes: number): number {
  const minutes = Math.max(1, marginalMinutes);
  return value / Math.pow(minutes, TIME_SENSITIVITY);
}

/**
 * Is the place open for the whole visit, given the projected arrival?
 * Places without recorded hours are treated as open — the data is optional.
 */
export function isOpenDuringVisit(
  candidate: PlannerCandidate,
  clock: PlannerClock | undefined,
  arrivalOffsetMinutes: number,
): boolean {
  if (!clock || !candidate.openingHours || candidate.openingHours.length === 0) return true;

  const absoluteArrival = clock.minutesOfDay + arrivalOffsetMinutes;
  const dayOffset = Math.floor(absoluteArrival / (24 * 60));
  const dayOfWeek = (clock.dayOfWeek + dayOffset) % 7;
  const minutesOfDay = absoluteArrival % (24 * 60);

  const hours = candidate.openingHours.find((h) => h.dayOfWeek === dayOfWeek);
  if (!hours) return true;
  if (hours.isClosed) return false;

  const departure = minutesOfDay + candidate.estimatedVisitDurationMinutes;
  return minutesOfDay >= hours.opensMinutes && departure <= hours.closesMinutes;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
