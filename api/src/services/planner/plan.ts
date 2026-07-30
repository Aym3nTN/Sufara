import type { LatLng } from '../../lib/geo.js';
import type { RoutingProvider, TravelLeg } from '../routing/types.js';
import { isOpenDuringVisit, marginalRatio, valueOf } from './scoring.js';
import type {
  BufferConfig,
  DroppedPlace,
  PlanRequest,
  PlanResult,
  PlanStop,
  PlannerCandidate,
} from './types.js';

const DEFAULT_BUFFER: BufferConfig = { ratio: 0.08, minMinutes: 10, maxMinutes: 30 };
const MAX_BUFFER_SHARE = 0.2;
const MAX_DROPPED_REPORTED = 10;

/**
 * Reserve slack so a small delay does not wreck the traveller's schedule.
 * Never fills 100% of the available time, and never eats more than a fifth of it.
 */
export function computeTargetBuffer(availableMinutes: number, config: BufferConfig): number {
  const proportional = Math.round(availableMinutes * config.ratio);
  const clamped = Math.min(config.maxMinutes, Math.max(config.minMinutes, proportional));
  const capped = Math.min(clamped, Math.floor(availableMinutes * MAX_BUFFER_SHARE));
  return Math.max(0, capped);
}

interface Evaluation {
  travelMinutes: number;
  visitMinutes: number;
  totalMinutes: number;
  distanceMeters: number;
  /** Arrival offset (minutes after departure) per stop, aligned with `seq`. */
  arrivals: number[];
  legs: TravelLeg[];
}

/**
 * The Smart Visit Planner.
 *
 * Pure with respect to persistence: it takes candidate places and a routing
 * provider, and returns an itinerary that fits the traveller's time.
 * Invariant: the returned plan never exceeds `availableMinutes` unless the
 * caller forced places in via `requiredPlaceIds` (Mode B), in which case the
 * overflow is reported in `overBudgetMinutes` rather than hidden.
 */
export async function planVisit(
  request: PlanRequest,
  routing: RoutingProvider,
): Promise<PlanResult> {
  const bufferConfig = request.buffer ?? DEFAULT_BUFFER;
  const interests = request.interestCategoryIds ?? [];
  const requiredIds = new Set(request.requiredPlaceIds ?? []);
  const clock = request.clock;
  const targetBuffer = computeTargetBuffer(request.availableMinutes, bufferConfig);
  const budget = Math.max(0, request.availableMinutes - targetBuffer);

  const dropped: DroppedPlace[] = [];
  const candidates = dedupe(request.candidates).filter((candidate) => {
    if (requiredIds.has(candidate.id)) return true;

    if (!isOpenAtAllToday(candidate, request)) {
      dropped.push({ placeId: candidate.id, name: candidate.name, reason: 'CLOSED' });
      return false;
    }
    if (candidate.estimatedVisitDurationMinutes > budget) {
      dropped.push({ placeId: candidate.id, name: candidate.name, reason: 'NO_TIME' });
      return false;
    }
    return true;
  });

  if (candidates.length === 0) {
    return emptyResult(request.availableMinutes, targetBuffer, dropped);
  }

  const points: LatLng[] = [
    request.start,
    ...candidates.map((c) => ({ latitude: c.latitude, longitude: c.longitude })),
    ...(request.end ? [request.end] : []),
  ];
  const matrix = await routing.getTravelMatrix(points, request.travelMode);
  const endIndex = request.end ? points.length - 1 : null;

  const leg = (fromCandidate: number | null, toCandidate: number | null): TravelLeg => {
    const from = fromCandidate === null ? 0 : fromCandidate + 1;
    const to = toCandidate === null ? (endIndex ?? 0) : toCandidate + 1;
    return matrix[from]?.[to] ?? { distanceMeters: 0, durationMinutes: 0 };
  };

  const evaluate = (seq: number[]): Evaluation => {
    let travelMinutes = 0;
    let visitMinutes = 0;
    let distanceMeters = 0;
    const arrivals: number[] = [];
    const legs: TravelLeg[] = [];

    let previous: number | null = null;
    for (const index of seq) {
      const hop = leg(previous, index);
      legs.push(hop);
      travelMinutes += hop.durationMinutes;
      distanceMeters += hop.distanceMeters;
      arrivals.push(travelMinutes + visitMinutes);
      visitMinutes += candidates[index]!.estimatedVisitDurationMinutes;
      previous = index;
    }

    if (endIndex !== null && seq.length > 0) {
      const hop = leg(previous, null);
      legs.push(hop);
      travelMinutes += hop.durationMinutes;
      distanceMeters += hop.distanceMeters;
    }

    return {
      travelMinutes,
      visitMinutes,
      totalMinutes: travelMinutes + visitMinutes,
      distanceMeters,
      arrivals,
      legs,
    };
  };

  const hoursFeasible = (seq: number[], evaluation = evaluate(seq)): boolean =>
    seq.every((index, position) =>
      isOpenDuringVisit(candidates[index]!, clock, evaluation.arrivals[position]!),
    );

  const legTooLong = (a: number | null, b: number | null): boolean =>
    request.maxLegMeters !== undefined && leg(a, b).distanceMeters > request.maxLegMeters;

  // --- Mode B: seed with the places the traveller explicitly asked for -------
  let sequence: number[] = [];
  const requiredIndexes = candidates
    .map((candidate, index) => (requiredIds.has(candidate.id) ? index : -1))
    .filter((index) => index >= 0);

  if (requiredIndexes.length > 0) {
    sequence = nearestNeighbourOrder(requiredIndexes, leg);
  }

  const maxPlaces = request.maxPlaces ?? Number.POSITIVE_INFINITY;
  const optionalIndexes = candidates
    .map((_, index) => index)
    .filter((index) => !sequence.includes(index));

  // --- Alternate improve/insert until nothing more fits ----------------------
  sequence = twoOpt(sequence, evaluate, hoursFeasible);

  let inserted = true;
  while (inserted && sequence.length < maxPlaces) {
    inserted = false;
    const current = evaluate(sequence);

    let best: { index: number; position: number; ratio: number } | null = null;

    for (const index of optionalIndexes) {
      if (sequence.includes(index)) continue;
      const candidate = candidates[index]!;
      const value = valueOf(candidate, interests);

      for (let position = 0; position <= sequence.length; position += 1) {
        const previous = position === 0 ? null : sequence[position - 1]!;
        const next = position === sequence.length ? null : sequence[position]!;

        // When appending at the very end of an open-ended route there is no
        // outbound leg to check, only the inbound one.
        if (legTooLong(previous, index)) continue;
        if ((next !== null || endIndex !== null) && legTooLong(index, next)) continue;

        const trial = [...sequence.slice(0, position), index, ...sequence.slice(position)];
        const trialEvaluation = evaluate(trial);
        const marginal = trialEvaluation.totalMinutes - current.totalMinutes;

        if (trialEvaluation.totalMinutes > budget) continue;
        if (!hoursFeasible(trial, trialEvaluation)) continue;

        const ratio = marginalRatio(value, marginal);
        if (!best || ratio > best.ratio) {
          best = { index, position, ratio };
        }
      }
    }

    if (best) {
      sequence = [...sequence.slice(0, best.position), best.index, ...sequence.slice(best.position)];
      sequence = twoOpt(sequence, evaluate, hoursFeasible);
      inserted = true;
    }
  }

  // --- Safety net: the invariant is enforced, not assumed --------------------
  if (requiredIndexes.length === 0) {
    while (sequence.length > 0 && evaluate(sequence).totalMinutes > request.availableMinutes) {
      const weakest = sequence.reduce((worst, index) =>
        valueOf(candidates[index]!, interests) < valueOf(candidates[worst]!, interests)
          ? index
          : worst,
      );
      sequence = sequence.filter((index) => index !== weakest);
      dropped.push({
        placeId: candidates[weakest]!.id,
        name: candidates[weakest]!.name,
        reason: 'NO_TIME',
      });
    }
  }

  const evaluation = evaluate(sequence);
  const stops: PlanStop[] = sequence.map((index, position) => ({
    placeId: candidates[index]!.id,
    order: position + 1,
    estimatedArrivalOffsetMinutes: evaluation.arrivals[position]!,
    estimatedVisitDurationMinutes: candidates[index]!.estimatedVisitDurationMinutes,
    travelTimeFromPreviousMinutes: evaluation.legs[position]!.durationMinutes,
    distanceFromPreviousMeters: evaluation.legs[position]!.distanceMeters,
  }));

  // Only report places as "left out" when the planner actually had room to
  // consider them. If it stopped because the stop limit was reached — which is
  // how an explicit Mode B selection is expressed — the rest of the city was
  // never in the running, and saying it "did not fit" would be wrong.
  if (sequence.length < maxPlaces) {
    for (const index of optionalIndexes) {
      if (sequence.includes(index)) continue;
      const candidate = candidates[index]!;
      if (dropped.some((d) => d.placeId === candidate.id)) continue;
      const unreachable = legTooLong(null, index);
      dropped.push({
        placeId: candidate.id,
        name: candidate.name,
        reason: unreachable ? 'TOO_FAR' : 'NO_TIME',
      });
    }
  }

  return {
    stops,
    totalTravelMinutes: evaluation.travelMinutes,
    totalVisitMinutes: evaluation.visitMinutes,
    totalMinutes: evaluation.totalMinutes,
    totalDistanceMeters: evaluation.distanceMeters,
    bufferMinutes: request.availableMinutes - evaluation.totalMinutes,
    targetBufferMinutes: targetBuffer,
    overBudgetMinutes: Math.max(0, evaluation.totalMinutes - request.availableMinutes),
    dropped: dropped.slice(0, MAX_DROPPED_REPORTED),
    notes: buildNotes({
      selected: sequence.map((index) => candidates[index]!),
      candidateCount: candidates.length,
      interests,
      evaluation,
      availableMinutes: request.availableMinutes,
    }),
  };
}

// ---------------------------------------------------------------------------
// Ordering helpers
// ---------------------------------------------------------------------------

function nearestNeighbourOrder(
  indexes: number[],
  leg: (from: number | null, to: number | null) => TravelLeg,
): number[] {
  const remaining = [...indexes];
  const order: number[] = [];
  let current: number | null = null;

  while (remaining.length > 0) {
    let bestPosition = 0;
    let bestMinutes = Number.POSITIVE_INFINITY;

    remaining.forEach((index, position) => {
      const minutes = leg(current, index).durationMinutes;
      if (minutes < bestMinutes) {
        bestMinutes = minutes;
        bestPosition = position;
      }
    });

    current = remaining[bestPosition]!;
    order.push(current);
    remaining.splice(bestPosition, 1);
  }

  return order;
}

/** 2-opt over the stop order: reduces travel time without changing which places are visited. */
function twoOpt(
  sequence: number[],
  evaluate: (seq: number[]) => Evaluation,
  feasible: (seq: number[], evaluation?: Evaluation) => boolean,
): number[] {
  if (sequence.length < 3) return sequence;

  let best = sequence;
  let bestTravel = evaluate(best).travelMinutes;
  let improved = true;
  let guard = 0;

  while (improved && guard < 50) {
    improved = false;
    guard += 1;

    for (let i = 0; i < best.length - 1; i += 1) {
      for (let j = i + 1; j < best.length; j += 1) {
        const trial = [
          ...best.slice(0, i),
          ...best.slice(i, j + 1).reverse(),
          ...best.slice(j + 1),
        ];
        const evaluation = evaluate(trial);
        if (evaluation.travelMinutes < bestTravel && feasible(trial, evaluation)) {
          best = trial;
          bestTravel = evaluation.travelMinutes;
          improved = true;
        }
      }
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

function dedupe(candidates: PlannerCandidate[]): PlannerCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.id)) return false;
    seen.add(candidate.id);
    return true;
  });
}

function isOpenAtAllToday(candidate: PlannerCandidate, request: PlanRequest): boolean {
  const clock = request.clock;
  if (!clock || !candidate.openingHours?.length) return true;
  const hours = candidate.openingHours.find((h) => h.dayOfWeek === clock.dayOfWeek);
  if (!hours) return true;
  if (hours.isClosed) return false;
  // Would still be open long enough after the earliest possible arrival?
  return hours.closesMinutes > clock.minutesOfDay;
}

function emptyResult(
  availableMinutes: number,
  targetBuffer: number,
  dropped: DroppedPlace[],
): PlanResult {
  return {
    stops: [],
    totalTravelMinutes: 0,
    totalVisitMinutes: 0,
    totalMinutes: 0,
    totalDistanceMeters: 0,
    bufferMinutes: availableMinutes,
    targetBufferMinutes: targetBuffer,
    overBudgetMinutes: 0,
    dropped: dropped.slice(0, MAX_DROPPED_REPORTED),
    notes: ['No place fits the time you have available. Try allowing more time.'],
  };
}

function buildNotes(input: {
  selected: PlannerCandidate[];
  candidateCount: number;
  interests: string[];
  evaluation: Evaluation;
  availableMinutes: number;
}): string[] {
  const notes: string[] = [];
  if (input.selected.length === 0) {
    return ['No place fits the time you have available. Try allowing more time.'];
  }

  notes.push(
    `Chose ${input.selected.length} of ${input.candidateCount} places that fit your ${formatMinutes(
      input.availableMinutes,
    )}.`,
  );

  const headline = [...input.selected].sort((a, b) => b.importanceScore - a.importanceScore)[0];
  if (headline) {
    notes.push(`${headline.name} was prioritised for its historical and religious significance.`);
  }

  if (input.interests.length > 0) {
    const matching = input.selected.filter((place) =>
      place.categoryIds.some((id) => input.interests.includes(id)),
    ).length;
    notes.push(`${matching} of ${input.selected.length} stops match the interests you selected.`);
  }

  notes.push(
    `${formatMinutes(input.evaluation.visitMinutes)} at the places, ${formatMinutes(
      input.evaluation.travelMinutes,
    )} travelling, ${formatMinutes(
      Math.max(0, input.availableMinutes - input.evaluation.totalMinutes),
    )} spare.`,
  );

  return notes;
}

export function formatMinutes(minutes: number): string {
  const value = Math.max(0, Math.round(minutes));
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest.toString().padStart(2, '0')}m`;
}
