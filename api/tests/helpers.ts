import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

export const app = createApp();
export const api = () => request(app);
export const V1 = '/api/v1';

/**
 * The password tests/globalSetup.ts generated and seeded with. Never a literal:
 * a hardcoded one would be a real credential for any deployment running the
 * seed, and secret scanners are right to flag it.
 */
export const SEED_PASSWORD = (() => {
  const value = process.env.SEED_PASSWORD;
  if (!value) {
    throw new Error('SEED_PASSWORD is unset — tests/globalSetup.ts should have provided it.');
  }
  return value;
})();

/** A fresh throwaway password for an account a test creates. */
export function randomPassword(): string {
  return `${randomBytes(9).toString('base64url')}aA1!`;
}

export async function login(email: string, password = SEED_PASSWORD) {
  const response = await api().post(`${V1}/auth/login`).send({ email, password });
  if (response.status !== 200) {
    throw new Error(`Login failed for ${email}: ${response.status} ${response.text}`);
  }
  return response.body as {
    accessToken: string;
    refreshToken: string;
    user: { id: string; role: string };
  };
}

export const asAdmin = () => login('admin@sufara.app');
export const asTraveler = () => login('traveler@sufara.app');

export async function cityByName(name: string) {
  const city = await prisma.city.findFirst({ where: { name } });
  if (!city) throw new Error(`Seed city ${name} is missing`);
  return city;
}

export async function categoryByKey(key: string) {
  const category = await prisma.category.findUnique({ where: { key } });
  if (!category) throw new Error(`Seed category ${key} is missing`);
  return category;
}

export async function placeByName(name: string) {
  const place = await prisma.place.findFirst({ where: { name: { contains: name } } });
  if (!place) throw new Error(`Seed place ${name} is missing`);
  return place;
}

/** Al-Masjid an-Nabawi's forecourt — the natural "I just arrived" reference point. */
export const MADINAH_CENTRE = { latitude: 24.4686, longitude: 39.6142 };
