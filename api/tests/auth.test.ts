import { describe, expect, it } from 'vitest';
import { api, asAdmin, asTraveler, login, randomPassword, SEED_PASSWORD, V1 } from './helpers.js';

describe('authentication', () => {
  it('registers a new traveller as USER, never as ADMIN', async () => {
    const email = `new-${Date.now()}@example.com`;
    const response = await api()
      .post(`${V1}/auth/register`)
      // A hostile client asking for the admin role must be ignored.
      .send({ name: 'New Traveller', email, password: randomPassword(), role: 'ADMIN' });

    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe('USER');
    expect(response.body.accessToken).toBeTruthy();
    expect(response.body.user.passwordHash).toBeUndefined();
  });

  it('rejects a duplicate email', async () => {
    const response = await api()
      .post(`${V1}/auth/register`)
      .send({ name: 'Copy', email: 'admin@sufara.app', password: randomPassword() });

    expect(response.status).toBe(409);
  });

  it('rejects weak passwords', async () => {
    const response = await api()
      .post(`${V1}/auth/register`)
      .send({ name: 'Weak', email: `weak-${Date.now()}@example.com`, password: 'short' });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('logs in and returns the current user', async () => {
    const { accessToken } = await asTraveler();
    const me = await api().get(`${V1}/auth/me`).set('Authorization', `Bearer ${accessToken}`);

    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('traveler@sufara.app');
  });

  it('gives the same answer for a wrong password and an unknown account', async () => {
    // Random, so it is definitionally not the account's password.
    const notThePassword = randomPassword();
    const wrongPassword = await api()
      .post(`${V1}/auth/login`)
      .send({ email: 'traveler@sufara.app', password: notThePassword });
    const unknownAccount = await api()
      .post(`${V1}/auth/login`)
      .send({ email: 'nobody@example.com', password: notThePassword });

    expect(wrongPassword.status).toBe(401);
    expect(unknownAccount.status).toBe(401);
    expect(unknownAccount.body.error.message).toBe(wrongPassword.body.error.message);
  });

  it('rotates refresh tokens and refuses the old one', async () => {
    const { refreshToken } = await asTraveler();

    const first = await api().post(`${V1}/auth/refresh`).send({ refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.refreshToken).not.toBe(refreshToken);

    const replay = await api().post(`${V1}/auth/refresh`).send({ refreshToken });
    expect(replay.status).toBe(401);
  });

  it('revokes a refresh token on logout', async () => {
    const { refreshToken } = await asTraveler();

    expect((await api().post(`${V1}/auth/logout`).send({ refreshToken })).status).toBe(204);
    expect((await api().post(`${V1}/auth/refresh`).send({ refreshToken })).status).toBe(401);
  });

  it('rejects requests with no token, a malformed token, or a forged token', async () => {
    expect((await api().get(`${V1}/me`)).status).toBe(401);
    expect((await api().get(`${V1}/me`).set('Authorization', 'Bearer nonsense')).status).toBe(401);
    expect((await api().get(`${V1}/me`).set('Authorization', 'Basic abc')).status).toBe(401);
  });

  it('resets a password and invalidates existing sessions', async () => {
    const email = `reset-${Date.now()}@example.com`;
    const original = randomPassword();
    const replacement = randomPassword();
    await api().post(`${V1}/auth/register`).send({ name: 'Reset Me', email, password: original });
    const session = await login(email, original);

    const forgot = await api().post(`${V1}/auth/forgot-password`).send({ email });
    expect(forgot.status).toBe(200);
    const token = forgot.body.devResetToken as string;
    expect(token).toBeTruthy();

    const reset = await api()
      .post(`${V1}/auth/reset-password`)
      .send({ token, password: replacement });
    expect(reset.status).toBe(200);

    // Old refresh token no longer works; the new password does.
    expect(
      (await api().post(`${V1}/auth/refresh`).send({ refreshToken: session.refreshToken })).status,
    ).toBe(401);
    expect((await login(email, replacement)).accessToken).toBeTruthy();

    // Single-use: the same reset token cannot be replayed.
    expect(
      (await api().post(`${V1}/auth/reset-password`).send({ token, password: randomPassword() })).status,
    ).toBe(401);
  });

  it('does not reveal whether an email is registered', async () => {
    const known = await api().post(`${V1}/auth/forgot-password`).send({ email: 'admin@sufara.app' });
    const unknown = await api()
      .post(`${V1}/auth/forgot-password`)
      .send({ email: 'definitely-not-registered@example.com' });

    expect(known.body.message).toBe(unknown.body.message);
  });

  it('keeps the seeded admin and traveller roles distinct', async () => {
    expect((await asAdmin()).user.role).toBe('ADMIN');
    expect((await asTraveler()).user.role).toBe('USER');
    expect(SEED_PASSWORD).toBeTruthy();
  });
});
