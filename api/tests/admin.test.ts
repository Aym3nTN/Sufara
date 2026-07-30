import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { api, randomPassword, app, asAdmin, asTraveler, categoryByKey, cityByName, placeByName, V1 } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';

type Method = 'get' | 'post';
const call = (method: Method, path: string) => request(app)[method](path);

const ADMIN_ROUTES: Array<[Method, string]> = [
  ['get', '/admin/stats'],
  ['get', '/admin/places'],
  ['get', '/admin/countries'],
  ['get', '/admin/cities'],
  ['get', '/admin/categories'],
  ['get', '/admin/users'],
  ['post', '/admin/places'],
  ['post', '/admin/countries'],
  ['post', '/admin/cities'],
  ['post', '/admin/categories'],
];

describe('admin authorization is enforced server-side', () => {
  it('refuses anonymous callers on every admin route', async () => {
    for (const [method, path] of ADMIN_ROUTES) {
      const response = await call(method, `${V1}${path}`).send({});
      expect(response.status, `${method.toUpperCase()} ${path}`).toBe(401);
    }
  });

  it('refuses an authenticated regular traveller on every admin route', async () => {
    const { accessToken } = await asTraveler();

    for (const [method, path] of ADMIN_ROUTES) {
      const response = await call(method, `${V1}${path}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});
      expect(response.status, `${method.toUpperCase()} ${path}`).toBe(403);
    }
  });

  it('does not let a traveller write content through the public API either', async () => {
    const { accessToken } = await asTraveler();
    const quba = await placeByName('Quba');

    const attempt = await api()
      .put(`${V1}/admin/places/${quba.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ importanceScore: 1 });

    expect(attempt.status).toBe(403);

    const unchanged = await prisma.place.findUnique({ where: { id: quba.id } });
    expect(unchanged?.importanceScore).toBeGreaterThan(50);
  });
});

describe('admin dashboard', () => {
  it('reports the content and user totals', async () => {
    const { accessToken } = await asAdmin();
    const response = await api().get(`${V1}/admin/stats`).set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.totals.places).toBeGreaterThan(30);
    expect(response.body.totals.countries).toBeGreaterThanOrEqual(5);
    expect(response.body.totals.cities).toBeGreaterThanOrEqual(5);
    expect(response.body.totals.users).toBeGreaterThanOrEqual(2);
    expect(response.body.recentPlaces.length).toBeGreaterThan(0);
    expect(response.body.placesByCategory.length).toBeGreaterThan(0);
  });
});

describe('admin place management', () => {
  it('creates, edits, deactivates and deletes a place', async () => {
    const { accessToken } = await asAdmin();
    const bearer = `Bearer ${accessToken}`;
    const madinah = await cityByName('Madinah');
    const mosque = await categoryByKey('MOSQUE');
    const history = await categoryByKey('HISTORICAL_SITE');

    const created = await api()
      .post(`${V1}/admin/places`)
      .set('Authorization', bearer)
      .send({
        name: 'Test Heritage Site',
        shortDescription: 'A place created by the admin test suite.',
        description: 'A longer description used to verify the admin create endpoint end to end.',
        countryId: madinah.countryId,
        cityId: madinah.id,
        latitude: 24.47,
        longitude: 39.61,
        primaryCategoryId: mosque.id,
        categoryIds: [history.id],
        estimatedVisitDurationMinutes: 25,
        importanceScore: 40,
        openingHours: [
          { dayOfWeek: 1, opensMinutes: 480, closesMinutes: 1080, isClosed: false },
          { dayOfWeek: 5, opensMinutes: 0, closesMinutes: 0, isClosed: true },
        ],
      });

    expect(created.status).toBe(201);
    const place = created.body.place;
    expect(place.slug).toBe('test-heritage-site');
    // The primary category is always part of the many-to-many set.
    expect(place.categories.map((c: { key: string }) => c.key).sort()).toEqual([
      'HISTORICAL_SITE',
      'MOSQUE',
    ]);
    expect(place.openingHours).toHaveLength(2);

    const updated = await api()
      .put(`${V1}/admin/places/${place.id}`)
      .set('Authorization', bearer)
      .send({ importanceScore: 77, estimatedVisitDurationMinutes: 35, status: 'INACTIVE' });

    expect(updated.status).toBe(200);
    expect(updated.body.place.importanceScore).toBe(77);
    expect(updated.body.place.status).toBe('INACTIVE');

    // A deactivated place disappears from the traveller-facing catalogue…
    const publicList = await api().get(`${V1}/places`).query({ cityId: madinah.id, limit: 100 });
    expect(publicList.body.items.some((entry: { id: string }) => entry.id === place.id)).toBe(false);
    expect((await api().get(`${V1}/places/${place.id}`)).status).toBe(404);

    // …but is still visible to admins.
    const adminList = await api()
      .get(`${V1}/admin/places`)
      .query({ cityId: madinah.id, limit: 100 })
      .set('Authorization', bearer);
    expect(adminList.body.items.some((entry: { id: string }) => entry.id === place.id)).toBe(true);

    expect(
      (await api().delete(`${V1}/admin/places/${place.id}`).set('Authorization', bearer)).status,
    ).toBe(204);
  });

  it('rejects a city that does not belong to the submitted country', async () => {
    const { accessToken } = await asAdmin();
    const madinah = await cityByName('Madinah');
    const istanbul = await cityByName('Istanbul');
    const mosque = await categoryByKey('MOSQUE');

    const response = await api()
      .post(`${V1}/admin/places`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Mismatched Geography',
        shortDescription: 'Country and city do not match.',
        description: 'This request should be rejected because the hierarchy is inconsistent.',
        countryId: madinah.countryId,
        cityId: istanbul.id,
        latitude: 41,
        longitude: 28.9,
        primaryCategoryId: mosque.id,
        estimatedVisitDurationMinutes: 30,
        importanceScore: 50,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toMatch(/does not belong/i);
  });

  it('validates coordinates, scores and durations', async () => {
    const { accessToken } = await asAdmin();
    const madinah = await cityByName('Madinah');
    const mosque = await categoryByKey('MOSQUE');

    const response = await api()
      .post(`${V1}/admin/places`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'X',
        shortDescription: 'no',
        description: 'short',
        countryId: madinah.countryId,
        cityId: madinah.id,
        latitude: 200,
        longitude: -400,
        primaryCategoryId: mosque.id,
        estimatedVisitDurationMinutes: 0,
        importanceScore: 500,
      });

    expect(response.status).toBe(422);
    const fields = response.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toContain('latitude');
    expect(fields).toContain('longitude');
    expect(fields).toContain('importanceScore');
    expect(fields).toContain('estimatedVisitDurationMinutes');
  });

  it('refuses to delete a place that is part of a saved itinerary', async () => {
    const admin = await asAdmin();
    const traveler = await asTraveler();
    const madinah = await cityByName('Madinah');
    const quba = await placeByName('Quba');

    const itinerary = await api()
      .post(`${V1}/itineraries`)
      .set('Authorization', `Bearer ${traveler.accessToken}`)
      .send({
        title: 'Referenced trip',
        cityId: madinah.id,
        startLatitude: 24.4686,
        startLongitude: 39.6142,
        availableMinutes: 120,
        stops: [{ placeId: quba.id, order: 1 }],
      });

    const attempt = await api()
      .delete(`${V1}/admin/places/${quba.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(attempt.status).toBe(409);
    expect(attempt.body.error.message).toMatch(/Deactivate it instead/i);

    await api()
      .delete(`${V1}/itineraries/${itinerary.body.itinerary.id}`)
      .set('Authorization', `Bearer ${traveler.accessToken}`);
  });

  it('filters and paginates the admin place list', async () => {
    const { accessToken } = await asAdmin();
    const bearer = `Bearer ${accessToken}`;

    const page = await api().get(`${V1}/admin/places`).query({ page: 1, limit: 5 }).set('Authorization', bearer);
    expect(page.body.items).toHaveLength(5);
    expect(page.body.total).toBeGreaterThan(5);
    expect(page.body.totalPages).toBeGreaterThan(1);

    const search = await api()
      .get(`${V1}/admin/places`)
      .query({ search: 'Azhar' })
      .set('Authorization', bearer);
    expect(search.body.items[0].name).toContain('Azhar');
  });
});

describe('admin geography management', () => {
  it('creates a country and a city, and protects the hierarchy on delete', async () => {
    const { accessToken } = await asAdmin();
    const bearer = `Bearer ${accessToken}`;
    const suffix = Date.now().toString().slice(-4);

    const country = await api()
      .post(`${V1}/admin/countries`)
      .set('Authorization', bearer)
      .send({ name: `Testland ${suffix}`, code: 'ZZ' });
    expect(country.status).toBe(201);
    expect(country.body.country.slug).toContain('testland');

    const city = await api()
      .post(`${V1}/admin/cities`)
      .set('Authorization', bearer)
      .send({
        name: `Test City ${suffix}`,
        countryId: country.body.country.id,
        latitude: 10,
        longitude: 20,
        timezone: 'UTC',
      });
    expect(city.status).toBe(201);
    expect(city.body.city.country.id).toBe(country.body.country.id);

    // A country with cities cannot be deleted out from under them.
    const blocked = await api()
      .delete(`${V1}/admin/countries/${country.body.country.id}`)
      .set('Authorization', bearer);
    expect(blocked.status).toBe(409);

    expect(
      (await api().delete(`${V1}/admin/cities/${city.body.city.id}`).set('Authorization', bearer)).status,
    ).toBe(204);
    expect(
      (await api().delete(`${V1}/admin/countries/${country.body.country.id}`).set('Authorization', bearer))
        .status,
    ).toBe(204);
  });

  it('manages categories', async () => {
    const { accessToken } = await asAdmin();
    const bearer = `Bearer ${accessToken}`;

    const created = await api()
      .post(`${V1}/admin/categories`)
      .set('Authorization', bearer)
      .send({ key: `test_${Date.now()}`, name: 'Test Category', colorHex: '#123456', sortOrder: 99 });

    expect(created.status).toBe(201);
    expect(created.body.category.key).toMatch(/^TEST_/);

    const updated = await api()
      .put(`${V1}/admin/categories/${created.body.category.id}`)
      .set('Authorization', bearer)
      .send({ name: 'Renamed Category' });
    expect(updated.body.category.name).toBe('Renamed Category');

    expect(
      (await api().delete(`${V1}/admin/categories/${created.body.category.id}`).set('Authorization', bearer))
        .status,
    ).toBe(204);
  });

  it('rejects a malformed category colour', async () => {
    const { accessToken } = await asAdmin();
    const response = await api()
      .post(`${V1}/admin/categories`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ key: 'BAD_COLOUR', name: 'Bad Colour', colorHex: 'green' });

    expect(response.status).toBe(422);
  });
});

describe('admin user management', () => {
  it('promotes and disables a user, and cuts their sessions', async () => {
    const { accessToken } = await asAdmin();
    const bearer = `Bearer ${accessToken}`;
    const email = `managed-${Date.now()}@example.com`;

    const registered = await api()
      .post(`${V1}/auth/register`)
      .send({ name: 'Managed User', email, password: randomPassword() });
    const userId = registered.body.user.id;

    const promoted = await api()
      .put(`${V1}/admin/users/${userId}`)
      .set('Authorization', bearer)
      .send({ role: 'ADMIN' });
    expect(promoted.body.user.role).toBe('ADMIN');

    const disabled = await api()
      .put(`${V1}/admin/users/${userId}`)
      .set('Authorization', bearer)
      .send({ isActive: false });
    expect(disabled.body.user.isActive).toBe(false);

    // Their existing access token stops working immediately.
    const blocked = await api()
      .get(`${V1}/me`)
      .set('Authorization', `Bearer ${registered.body.accessToken}`);
    expect(blocked.status).toBe(401);
  });

  it('stops an admin from locking themselves out', async () => {
    const admin = await asAdmin();
    const response = await api()
      .put(`${V1}/admin/users/${admin.user.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ role: 'USER' });

    expect(response.status).toBe(400);
    expect((await asAdmin()).user.role).toBe('ADMIN');
  });
});
