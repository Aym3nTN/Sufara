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


/** A minimal valid 8×8 PNG, for exercising the image-upload path. */
export function onePixelPng(): Buffer {
  const crc = (buf: Buffer): number => {
    let c = ~0;
    for (const byte of buf) {
      c ^= byte;
      for (let i = 0; i < 8; i += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return (~c) >>> 0;
  };
  const chunk = (type: string, data: Buffer): Buffer => {
    const typeBuf = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc(Buffer.concat([typeBuf, data])));
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(8, 0);
  ihdr.writeUInt32BE(8, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour

  const zlib = require('node:zlib') as typeof import('node:zlib');
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(8 * 3, 0xff)]);
  const idat = zlib.deflateSync(Buffer.concat(Array.from({ length: 8 }, () => row)));

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
