/**
 * The primary acceptance test from the brief:
 *
 *   "I just arrived in Madinah, I have four hours. Plan my visit."
 *
 * It walks the whole flow end to end — city, planner, route, save, navigate,
 * progress — through the HTTP API, exactly as the mobile app does.
 */
import { describe, expect, it } from 'vitest';
import { api, randomPassword, asTraveler, cityByName, categoryByKey, MADINAH_CENTRE, placeByName, V1 } from './helpers.js';

describe('end-to-end: four hours in Madinah', () => {
  it('takes a traveller from arrival to a saved, in-progress journey', async () => {
    const { accessToken } = await asTraveler();
    const auth = (request: ReturnType<typeof api>['get']) => request;

    // 1. The traveller opens the app and picks a city.
    const cities = await api().get(`${V1}/cities`);
    expect(cities.status).toBe(200);
    const madinah = cities.body.items.find((city: { name: string }) => city.name === 'Madinah');
    expect(madinah).toBeTruthy();
    expect(madinah.placeCount).toBeGreaterThan(5);
    expect(madinah.country.code).toBe('SA');

    // 2. They choose their interests.
    const categories = await api().get(`${V1}/categories`);
    const mosque = categories.body.items.find((c: { key: string }) => c.key === 'MOSQUE');
    const history = categories.body.items.find((c: { key: string }) => c.key === 'HISTORICAL_SITE');
    const battle = categories.body.items.find((c: { key: string }) => c.key === 'BATTLE_SITE');
    expect([mosque, history, battle].every(Boolean)).toBe(true);

    // 3. "Four hours, from where I am, interested in Islamic history."
    const generated = await api()
      .post(`${V1}/planner/generate`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        cityId: madinah.id,
        start: MADINAH_CENTRE,
        startLabel: 'Your current location',
        availableMinutes: 240,
        travelMode: 'DRIVING',
        interestCategoryIds: [mosque.id, history.id, battle.id],
      });

    expect(generated.status).toBe(200);
    const plan = generated.body.plan;

    // The itinerary must be real, ordered, timed and inside the four hours.
    expect(plan.stops.length).toBeGreaterThanOrEqual(3);
    expect(plan.totals.totalMinutes).toBeLessThanOrEqual(240);
    expect(plan.totals.bufferMinutes).toBeGreaterThan(0);
    expect(plan.totals.travelMinutes).toBeGreaterThan(0);
    expect(plan.totals.visitMinutes).toBeGreaterThan(0);
    expect(plan.totals.distanceMeters).toBeGreaterThan(0);
    expect(plan.stops.map((s: { order: number }) => s.order)).toEqual(
      plan.stops.map((_: unknown, index: number) => index + 1),
    );

    // Each stop carries the full place payload the UI needs.
    for (const stop of plan.stops) {
      expect(stop.place.name).toBeTruthy();
      expect(stop.place.city.name).toBe('Madinah');
      expect(stop.place.primaryCategory.key).toBeTruthy();
      expect(stop.place.latitude).toBeGreaterThan(24);
      expect(stop.estimatedVisitDurationMinutes).toBeGreaterThan(0);
    }

    // A route the map screen can draw, and reasons the UI can explain.
    expect(plan.route.coordinates.length).toBeGreaterThanOrEqual(plan.stops.length + 1);
    expect(plan.notes.length).toBeGreaterThan(0);

    // Madinah's foremost site should be on a four-hour, history-minded plan.
    const names = plan.stops.map((s: { place: { name: string } }) => s.place.name);
    expect(names.some((name: string) => name.includes('Nabawi'))).toBe(true);

    // 4. The traveller saves the generated itinerary as a trip.
    const saved = await api()
      .post(`${V1}/itineraries`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Madinah — 4 hours',
        cityId: madinah.id,
        startLabel: plan.start.label,
        startLatitude: plan.start.latitude,
        startLongitude: plan.start.longitude,
        availableMinutes: 240,
        travelMode: 'DRIVING',
        totalTravelMinutes: plan.totals.travelMinutes,
        totalVisitMinutes: plan.totals.visitMinutes,
        totalDistanceMeters: plan.totals.distanceMeters,
        bufferMinutes: plan.totals.bufferMinutes,
        stops: plan.stops.map((stop: Record<string, unknown> & { place: { id: string } }) => ({
          placeId: stop.place.id,
          order: stop.order,
          estimatedArrivalOffsetMinutes: stop.estimatedArrivalOffsetMinutes,
          estimatedVisitDurationMinutes: stop.estimatedVisitDurationMinutes,
          travelTimeFromPreviousMinutes: stop.travelTimeFromPreviousMinutes,
          distanceFromPreviousMeters: stop.distanceFromPreviousMeters,
        })),
      });

    expect(saved.status).toBe(201);
    const itinerary = saved.body.itinerary;
    expect(itinerary.stops).toHaveLength(plan.stops.length);

    // A saved itinerary reproduces itself without re-running the planner.
    const reloaded = await api()
      .get(`${V1}/itineraries/${itinerary.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(reloaded.status).toBe(200);
    expect(reloaded.body.itinerary.stops[0].place.name).toBe(itinerary.stops[0].place.name);
    expect(reloaded.body.itinerary.stops[0].travelTimeFromPreviousMinutes).toBe(
      itinerary.stops[0].travelTimeFromPreviousMinutes,
    );

    // 5. They start the journey and complete the first stop.
    const progressed = await api()
      .patch(`${V1}/itineraries/${itinerary.id}/stops/${itinerary.stops[0].id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ completed: true });

    expect(progressed.status).toBe(200);
    expect(progressed.body.itinerary.status).toBe('IN_PROGRESS');
    expect(progressed.body.itinerary.stops[0].completedAt).toBeTruthy();

    // 6. The trip appears in "My Trips".
    const trips = await api().get(`${V1}/itineraries`).set('Authorization', `Bearer ${accessToken}`);
    expect(trips.body.items.some((entry: { id: string }) => entry.id === itinerary.id)).toBe(true);

    await api()
      .delete(`${V1}/itineraries/${itinerary.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(auth).toBeTruthy();
  });
});

describe('planner modes', () => {
  it('Mode B: orders a traveller’s own six places', async () => {
    const madinah = await cityByName('Madinah');
    const chosen = await Promise.all(
      ['Quba', 'Qiblatayn', 'Uhud', 'Baqi', 'Ghamama', 'Jumu'].map((name) => placeByName(name)),
    );

    const response = await api()
      .post(`${V1}/planner/optimize`)
      .send({
        cityId: madinah.id,
        start: MADINAH_CENTRE,
        availableMinutes: 360,
        travelMode: 'DRIVING',
        selectedPlaceIds: chosen.map((place) => place.id),
      });

    expect(response.status).toBe(200);
    const plan = response.body.plan;
    expect(plan.stops).toHaveLength(6);
    expect(plan.stops.map((s: { place: { id: string } }) => s.place.id).sort()).toEqual(
      chosen.map((place) => place.id).sort(),
    );
    expect(plan.totals.travelMinutes).toBeGreaterThan(0);
  });

  it('Mode C: fills a full day without overrunning it', async () => {
    const madinah = await cityByName('Madinah');
    const response = await api()
      .post(`${V1}/planner/generate`)
      .send({
        cityId: madinah.id,
        start: MADINAH_CENTRE,
        availableMinutes: 8 * 60,
        travelMode: 'DRIVING',
      });

    expect(response.status).toBe(200);
    expect(response.body.plan.totals.totalMinutes).toBeLessThanOrEqual(8 * 60);
    expect(response.body.plan.stops.length).toBeGreaterThanOrEqual(4);
  });

  it('a 90-minute window returns only what genuinely fits', async () => {
    const madinah = await cityByName('Madinah');
    const response = await api()
      .post(`${V1}/planner/generate`)
      .send({
        cityId: madinah.id,
        start: MADINAH_CENTRE,
        availableMinutes: 90,
        travelMode: 'DRIVING',
      });

    const plan = response.body.plan;
    expect(plan.totals.totalMinutes).toBeLessThanOrEqual(90);
    expect(plan.stops.length).toBeGreaterThan(0);
    expect(plan.warnings.length).toBeGreaterThan(0);
  });

  it('warns instead of silently reshuffling when the editor adds one stop too many', async () => {
    const madinah = await cityByName('Madinah');
    const chosen = await Promise.all(
      ['Nabawi', 'Quba', 'Qiblatayn', 'Uhud'].map((name) => placeByName(name)),
    );

    const response = await api()
      .post(`${V1}/planner/preview`)
      .send({
        cityId: madinah.id,
        start: MADINAH_CENTRE,
        availableMinutes: 120,
        travelMode: 'DRIVING',
        selectedPlaceIds: chosen.map((place) => place.id),
      });

    expect(response.status).toBe(200);
    const plan = response.body.plan;
    // Order preserved exactly as submitted.
    expect(plan.stops.map((s: { place: { id: string } }) => s.place.id)).toEqual(
      chosen.map((place) => place.id),
    );
    expect(plan.totals.overBudgetMinutes).toBeGreaterThan(0);
    expect(plan.warnings[0]).toMatch(/longer than/i);
  });

  it('respects a walking traveller’s tolerance', async () => {
    const madinah = await cityByName('Madinah');
    const response = await api()
      .post(`${V1}/planner/generate`)
      .send({
        cityId: madinah.id,
        start: MADINAH_CENTRE,
        availableMinutes: 180,
        travelMode: 'WALKING',
        walkingTolerance: 'LOW',
      });

    const plan = response.body.plan;
    expect(plan.totals.totalMinutes).toBeLessThanOrEqual(180);
    for (const stop of plan.stops) {
      expect(stop.distanceFromPreviousMeters).toBeLessThanOrEqual(1_200);
    }
  });

  it('validates planner input', async () => {
    const madinah = await cityByName('Madinah');
    const response = await api()
      .post(`${V1}/planner/generate`)
      .send({
        cityId: madinah.id,
        start: { latitude: 999, longitude: 39 },
        availableMinutes: 5,
        travelMode: 'TELEPORT',
      });

    expect(response.status).toBe(422);
    expect(response.body.error.details.length).toBeGreaterThan(0);
  });

  it('uses the traveller’s saved preferences when the request omits them', async () => {
    const { accessToken } = await asTraveler();
    const museum = await categoryByKey('MUSEUM');

    await api()
      .put(`${V1}/me/preferences`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ travelMode: 'WALKING', interestCategoryIds: [museum.id] });

    const madinah = await cityByName('Madinah');
    const response = await api()
      .post(`${V1}/planner/generate`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ cityId: madinah.id, start: MADINAH_CENTRE, availableMinutes: 240 });

    expect(response.status).toBe(200);
    expect(response.body.plan.travelMode).toBe('WALKING');

    // Restore the seeded preferences for other suites.
    const mosque = await categoryByKey('MOSQUE');
    const history = await categoryByKey('HISTORICAL_SITE');
    await api()
      .put(`${V1}/me/preferences`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ travelMode: 'DRIVING', interestCategoryIds: [mosque.id, history.id] });
  });
});

describe('catalog and saved places', () => {
  it('lists, searches, filters and sorts places', async () => {
    const madinah = await cityByName('Madinah');
    const mosque = await categoryByKey('MOSQUE');

    const byCity = await api().get(`${V1}/places`).query({ cityId: madinah.id, limit: 50 });
    expect(byCity.status).toBe(200);
    expect(byCity.body.items.length).toBeGreaterThan(5);
    expect(byCity.body.items.every((p: { city: { id: string } }) => p.city.id === madinah.id)).toBe(true);

    const byCategory = await api().get(`${V1}/places`).query({ categoryId: mosque.id, limit: 50 });
    expect(
      byCategory.body.items.every((place: { categories: Array<{ key: string }> }) =>
        place.categories.some((category) => category.key === 'MOSQUE'),
      ),
    ).toBe(true);

    const search = await api().get(`${V1}/places`).query({ search: 'Quba' });
    expect(search.body.items[0].name).toContain('Quba');

    const byDistance = await api()
      .get(`${V1}/places`)
      .query({ cityId: madinah.id, sort: 'distance', ...MADINAH_CENTRE, limit: 10 });
    const distances = byDistance.body.items.map((p: { distanceMeters: number }) => p.distanceMeters);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it('finds places near a coordinate', async () => {
    const response = await api()
      .get(`${V1}/places/nearby`)
      .query({ ...MADINAH_CENTRE, radiusMeters: 8000 });

    expect(response.status).toBe(200);
    expect(response.body.items.length).toBeGreaterThan(0);
    expect(response.body.items.every((p: { distanceMeters: number }) => p.distanceMeters <= 8000)).toBe(
      true,
    );
  });

  it('returns full detail for a place', async () => {
    const quba = await placeByName('Quba');
    const response = await api().get(`${V1}/places/${quba.id}`).query(MADINAH_CENTRE);

    expect(response.status).toBe(200);
    expect(response.body.place.description.length).toBeGreaterThan(100);
    expect(response.body.place.estimatedVisitDurationMinutes).toBeGreaterThan(0);
    expect(response.body.place.distanceMeters).toBeGreaterThan(0);
    expect(response.body.place.categories.length).toBeGreaterThan(0);
  });

  it('404s an unknown place', async () => {
    expect((await api().get(`${V1}/places/does-not-exist`)).status).toBe(404);
  });

  it('saves and unsaves a place', async () => {
    const { accessToken } = await asTraveler();
    const uhud = await placeByName('Uhud');
    const bearer = `Bearer ${accessToken}`;

    expect((await api().post(`${V1}/me/saved-places`).set('Authorization', bearer).send({ placeId: uhud.id })).status).toBe(201);

    const saved = await api().get(`${V1}/me/saved-places`).set('Authorization', bearer);
    expect(saved.body.items.some((entry: { place: { id: string } }) => entry.place.id === uhud.id)).toBe(
      true,
    );

    // The place list reflects the saved state for the signed-in traveller.
    const detail = await api().get(`${V1}/places/${uhud.id}`).set('Authorization', bearer);
    expect(detail.body.place.isSaved).toBe(true);

    expect(
      (await api().delete(`${V1}/me/saved-places/${uhud.id}`).set('Authorization', bearer)).status,
    ).toBe(204);
    const after = await api().get(`${V1}/me/saved-places`).set('Authorization', bearer);
    expect(after.body.items.some((entry: { place: { id: string } }) => entry.place.id === uhud.id)).toBe(
      false,
    );
  });

  it('keeps one traveller’s itineraries invisible to another', async () => {
    const traveler = await asTraveler();
    const madinah = await cityByName('Madinah');
    const quba = await placeByName('Quba');

    const created = await api()
      .post(`${V1}/itineraries`)
      .set('Authorization', `Bearer ${traveler.accessToken}`)
      .send({
        title: 'Private trip',
        cityId: madinah.id,
        startLatitude: MADINAH_CENTRE.latitude,
        startLongitude: MADINAH_CENTRE.longitude,
        availableMinutes: 120,
        stops: [{ placeId: quba.id, order: 1 }],
      });
    expect(created.status).toBe(201);

    const email = `other-${Date.now()}@example.com`;
    const other = await api()
      .post(`${V1}/auth/register`)
      .send({ name: 'Other Traveller', email, password: randomPassword() });

    const attempt = await api()
      .get(`${V1}/itineraries/${created.body.itinerary.id}`)
      .set('Authorization', `Bearer ${other.body.accessToken}`);

    expect(attempt.status).toBe(404);
  });
});
