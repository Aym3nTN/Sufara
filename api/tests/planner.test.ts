import { describe, expect, it } from 'vitest';
import { HaversineRoutingProvider } from '../src/services/routing/index.js';
import {
  computeTargetBuffer,
  planVisit,
  valueOf,
  type PlannerCandidate,
} from '../src/services/planner/index.js';

const routing = new HaversineRoutingProvider();
const MADINAH = { latitude: 24.4686, longitude: 39.6142 };

const MOSQUE = 'cat-mosque';
const MUSEUM = 'cat-museum';

function candidate(overrides: Partial<PlannerCandidate> & { id: string }): PlannerCandidate {
  return {
    name: overrides.id,
    latitude: 24.47,
    longitude: 39.61,
    importanceScore: 50,
    estimatedVisitDurationMinutes: 30,
    categoryIds: [MOSQUE],
    ...overrides,
  };
}

const MADINAH_CANDIDATES: PlannerCandidate[] = [
  candidate({
    id: 'nabawi',
    name: 'Al-Masjid an-Nabawi',
    latitude: 24.4672,
    longitude: 39.6112,
    importanceScore: 100,
    estimatedVisitDurationMinutes: 60,
  }),
  candidate({
    id: 'quba',
    name: 'Quba Mosque',
    latitude: 24.4392,
    longitude: 39.6172,
    importanceScore: 92,
    estimatedVisitDurationMinutes: 45,
  }),
  candidate({
    id: 'qiblatayn',
    name: 'Masjid al-Qiblatayn',
    latitude: 24.4842,
    longitude: 39.5786,
    importanceScore: 85,
    estimatedVisitDurationMinutes: 30,
  }),
  candidate({
    id: 'uhud',
    name: 'Mount Uhud',
    latitude: 24.5045,
    longitude: 39.6142,
    importanceScore: 88,
    estimatedVisitDurationMinutes: 45,
    categoryIds: ['cat-battle'],
  }),
  candidate({
    id: 'ghamama',
    name: 'Masjid al-Ghamama',
    latitude: 24.4675,
    longitude: 39.6096,
    importanceScore: 62,
    estimatedVisitDurationMinutes: 20,
  }),
  candidate({
    id: 'museum',
    name: 'Dar al-Madinah Museum',
    latitude: 24.4622,
    longitude: 39.6008,
    importanceScore: 58,
    estimatedVisitDurationMinutes: 60,
    categoryIds: [MUSEUM],
  }),
];

describe('buffer strategy', () => {
  it('never fills the whole available window', () => {
    const config = { ratio: 0.08, minMinutes: 10, maxMinutes: 30 };
    expect(computeTargetBuffer(240, config)).toBeGreaterThanOrEqual(10);
    expect(computeTargetBuffer(240, config)).toBeLessThanOrEqual(30);
    expect(computeTargetBuffer(600, config)).toBeLessThanOrEqual(30);
    // Short windows still keep slack, but never a fifth or more of the window.
    expect(computeTargetBuffer(30, config)).toBeLessThanOrEqual(6);
  });
});

describe('Smart Visit Planner', () => {
  const base = {
    start: MADINAH,
    travelMode: 'DRIVING' as const,
    candidates: MADINAH_CANDIDATES,
  };

  it('plans a four-hour Madinah visit that fits the available time', async () => {
    const plan = await planVisit({ ...base, availableMinutes: 240 }, routing);

    expect(plan.stops.length).toBeGreaterThanOrEqual(3);
    expect(plan.totalMinutes).toBeLessThanOrEqual(240);
    expect(plan.totalMinutes).toBe(plan.totalTravelMinutes + plan.totalVisitMinutes);
    expect(plan.bufferMinutes).toBeGreaterThan(0);
    expect(plan.overBudgetMinutes).toBe(0);
    expect(plan.stops.map((stop) => stop.order)).toEqual(
      Array.from({ length: plan.stops.length }, (_, index) => index + 1),
    );
  });

  it('never exceeds the available time, at any window length', async () => {
    for (const availableMinutes of [30, 45, 60, 90, 120, 240, 480, 600]) {
      const plan = await planVisit({ ...base, availableMinutes }, routing);
      expect(
        plan.totalMinutes,
        `plan for ${availableMinutes} minutes came back at ${plan.totalMinutes}`,
      ).toBeLessThanOrEqual(availableMinutes);
    }
  });

  it('leaves at least the target buffer unplanned', async () => {
    const plan = await planVisit(
      { ...base, availableMinutes: 240, buffer: { ratio: 0.08, minMinutes: 10, maxMinutes: 30 } },
      routing,
    );
    expect(plan.bufferMinutes).toBeGreaterThanOrEqual(plan.targetBufferMinutes);
  });

  it('prefers a significant site over a merely closer one', async () => {
    // 90 minutes is enough for roughly one substantial stop plus travel.
    const plan = await planVisit({ ...base, availableMinutes: 90 }, routing);
    const ids = plan.stops.map((stop) => stop.placeId);

    expect(ids).toContain('nabawi');
    // The low-importance museum costs 60 minutes; it must not crowd out Nabawi.
    expect(ids).not.toContain('museum');
  });

  it('accepts a farther, more important place over a near, trivial one', async () => {
    const near = candidate({
      id: 'near-trivial',
      name: 'Nearby minor site',
      latitude: 24.4690,
      longitude: 39.6145,
      importanceScore: 10,
      estimatedVisitDurationMinutes: 20,
    });
    const far = candidate({
      id: 'far-important',
      name: 'Farther major site',
      latitude: 24.5300,
      longitude: 39.6500,
      importanceScore: 98,
      estimatedVisitDurationMinutes: 30,
    });

    const plan = await planVisit(
      { start: MADINAH, travelMode: 'DRIVING', candidates: [near, far], availableMinutes: 70 },
      routing,
    );

    expect(plan.stops[0]?.placeId).toBe('far-important');
  });

  it('biases towards the traveller’s interests without hard-filtering', async () => {
    const withInterest = await planVisit(
      { ...base, availableMinutes: 480, interestCategoryIds: [MUSEUM] },
      routing,
    );
    const ids = withInterest.stops.map((stop) => stop.placeId);

    expect(ids).toContain('museum');
    // A narrow interest must not empty the itinerary of everything else.
    expect(ids.filter((id) => id !== 'museum').length).toBeGreaterThan(0);
  });

  it('raises an interest match above an equally significant non-match', () => {
    const museum = MADINAH_CANDIDATES.find((c) => c.id === 'museum')!;
    const mosque = MADINAH_CANDIDATES.find((c) => c.id === 'ghamama')!;

    // Ghamama scores slightly higher on significance than the museum…
    expect(mosque.importanceScore).toBeGreaterThan(museum.importanceScore);
    expect(valueOf(museum, [])).toBeLessThan(valueOf(mosque, []));
    // …but for a traveller who asked for museums, the museum outranks it.
    expect(valueOf(museum, [MUSEUM])).toBeGreaterThan(valueOf(mosque, [MUSEUM]));
  });

  it('caps the number of stops when asked', async () => {
    const plan = await planVisit({ ...base, availableMinutes: 600, maxPlaces: 2 }, routing);
    expect(plan.stops).toHaveLength(2);
  });

  it('reports what it left out and why', async () => {
    const plan = await planVisit({ ...base, availableMinutes: 90 }, routing);
    expect(plan.dropped.length).toBeGreaterThan(0);
    expect(plan.dropped.every((entry) => ['NO_TIME', 'CLOSED', 'TOO_FAR'].includes(entry.reason))).toBe(
      true,
    );
    expect(plan.notes.length).toBeGreaterThan(0);
  });

  it('schedules arrival offsets consistently with travel and visit times', async () => {
    const plan = await planVisit({ ...base, availableMinutes: 300 }, routing);

    let expected = 0;
    for (const stop of plan.stops) {
      expected += stop.travelTimeFromPreviousMinutes;
      expect(stop.estimatedArrivalOffsetMinutes).toBe(expected);
      expected += stop.estimatedVisitDurationMinutes;
    }
  });
});

describe('Mode B — traveller picks the places', () => {
  it('includes every requested place and orders them efficiently', async () => {
    const requested = ['uhud', 'quba', 'qiblatayn', 'nabawi'];
    const plan = await planVisit(
      {
        start: MADINAH,
        travelMode: 'DRIVING',
        candidates: MADINAH_CANDIDATES,
        availableMinutes: 300,
        requiredPlaceIds: requested,
        maxPlaces: requested.length,
      },
      routing,
    );

    expect(plan.stops).toHaveLength(4);
    expect(plan.stops.map((stop) => stop.placeId).sort()).toEqual([...requested].sort());
  });

  it('reports an overrun instead of silently dropping a requested place', async () => {
    const plan = await planVisit(
      {
        start: MADINAH,
        travelMode: 'DRIVING',
        candidates: MADINAH_CANDIDATES,
        availableMinutes: 60,
        requiredPlaceIds: ['uhud', 'quba', 'qiblatayn', 'nabawi'],
        maxPlaces: 4,
      },
      routing,
    );

    expect(plan.stops).toHaveLength(4);
    expect(plan.overBudgetMinutes).toBeGreaterThan(0);
  });

  it('does not claim other places “did not fit” when the selection is explicit', async () => {
    const requested = ['nabawi', 'quba'];
    const plan = await planVisit(
      {
        start: MADINAH,
        travelMode: 'DRIVING',
        candidates: MADINAH_CANDIDATES,
        availableMinutes: 600,
        requiredPlaceIds: requested,
        maxPlaces: requested.length,
      },
      routing,
    );

    expect(plan.stops).toHaveLength(2);
    // The rest of the city was never in the running, so nothing was dropped.
    expect(plan.dropped).toHaveLength(0);
  });

  it('produces a route no longer than the traveller’s own ordering', async () => {
    const requested = ['uhud', 'quba', 'qiblatayn', 'nabawi'];
    const optimised = await planVisit(
      {
        start: MADINAH,
        travelMode: 'DRIVING',
        candidates: MADINAH_CANDIDATES,
        availableMinutes: 600,
        requiredPlaceIds: requested,
        maxPlaces: requested.length,
      },
      routing,
    );

    // Naive as-listed ordering, for comparison.
    let naiveTravel = 0;
    let previous = MADINAH;
    for (const id of requested) {
      const place = MADINAH_CANDIDATES.find((c) => c.id === id)!;
      const point = { latitude: place.latitude, longitude: place.longitude };
      naiveTravel += (await routing.getTravelLeg(previous, point, 'DRIVING')).durationMinutes;
      previous = point;
    }

    expect(optimised.totalTravelMinutes).toBeLessThanOrEqual(naiveTravel);
  });
});

describe('opening hours', () => {
  it('does not schedule a place that would be closed on arrival', async () => {
    const closingSoon = candidate({
      id: 'closes-at-18',
      name: 'Museum closing at 18:00',
      latitude: 24.4800,
      longitude: 39.6300,
      importanceScore: 99,
      estimatedVisitDurationMinutes: 60,
      openingHours: [
        { dayOfWeek: 1, opensMinutes: 8 * 60, closesMinutes: 18 * 60, isClosed: false },
      ],
    });
    const alwaysOpen = candidate({
      id: 'always-open',
      name: 'Open mosque',
      latitude: 24.4700,
      longitude: 39.6150,
      importanceScore: 60,
    });

    // Monday 17:20 — 25 minutes of travel leaves no room for a 60-minute visit.
    const plan = await planVisit(
      {
        start: MADINAH,
        travelMode: 'DRIVING',
        candidates: [closingSoon, alwaysOpen],
        availableMinutes: 240,
        clock: { dayOfWeek: 1, minutesOfDay: 17 * 60 + 20 },
      },
      routing,
    );

    const ids = plan.stops.map((stop) => stop.placeId);
    expect(ids).not.toContain('closes-at-18');
    expect(ids).toContain('always-open');
    expect(plan.dropped.some((entry) => entry.placeId === 'closes-at-18')).toBe(true);
  });

  it('drops a place that is closed all day', async () => {
    const closedToday = candidate({
      id: 'closed-friday',
      name: 'Closed on Friday',
      importanceScore: 95,
      openingHours: [{ dayOfWeek: 5, opensMinutes: 0, closesMinutes: 0, isClosed: true }],
    });

    const plan = await planVisit(
      {
        start: MADINAH,
        travelMode: 'DRIVING',
        candidates: [closedToday],
        availableMinutes: 240,
        clock: { dayOfWeek: 5, minutesOfDay: 10 * 60 },
      },
      routing,
    );

    expect(plan.stops).toHaveLength(0);
    expect(plan.dropped[0]).toMatchObject({ placeId: 'closed-friday', reason: 'CLOSED' });
  });
});

describe('walking tolerance', () => {
  it('will not put a distant stop on a walking itinerary', async () => {
    const walkable = candidate({
      id: 'walkable',
      name: 'Around the corner',
      latitude: 24.4692,
      longitude: 39.6150,
      importanceScore: 55,
      estimatedVisitDurationMinutes: 20,
    });
    const tooFar = candidate({
      id: 'too-far',
      name: 'Across the city',
      latitude: 24.5100,
      longitude: 39.5700,
      importanceScore: 99,
      estimatedVisitDurationMinutes: 20,
    });

    const plan = await planVisit(
      {
        start: MADINAH,
        travelMode: 'WALKING',
        candidates: [walkable, tooFar],
        availableMinutes: 480,
        maxLegMeters: 1_200,
      },
      routing,
    );

    const ids = plan.stops.map((stop) => stop.placeId);
    expect(ids).toContain('walkable');
    expect(ids).not.toContain('too-far');
    expect(plan.dropped.find((entry) => entry.placeId === 'too-far')?.reason).toBe('TOO_FAR');
  });
});

describe('degenerate input', () => {
  it('returns an empty plan rather than an impossible one', async () => {
    const plan = await planVisit(
      {
        start: MADINAH,
        travelMode: 'DRIVING',
        candidates: [candidate({ id: 'long', estimatedVisitDurationMinutes: 300 })],
        availableMinutes: 30,
      },
      routing,
    );

    expect(plan.stops).toHaveLength(0);
    expect(plan.totalMinutes).toBe(0);
    expect(plan.notes[0]).toMatch(/No place fits/i);
  });
});
