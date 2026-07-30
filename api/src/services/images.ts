import sharp from 'sharp';
import { badRequest } from '../lib/errors.js';

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const DISPLAY_WIDTH = 1600;
const THUMBNAIL_WIDTH = 480;

const MAGIC: Array<{ ext: 'jpg' | 'png' | 'webp'; test: (b: Buffer) => boolean }> = [
  { ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    ext: 'png',
    test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    ext: 'webp',
    test: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP',
  },
];

export interface ProcessedImage {
  display: Buffer;
  thumbnail: Buffer;
  width: number;
  height: number;
  contentType: string;
  extension: string;
}

/**
 * Validates by magic bytes (not by the client-supplied MIME type), then
 * re-encodes. Re-encoding both bounds the size and strips EXIF, which on
 * traveller photos routinely carries GPS coordinates and device identifiers.
 */
export async function processPlaceImage(buffer: Buffer): Promise<ProcessedImage> {
  if (buffer.length === 0) throw badRequest('Uploaded file is empty');
  if (buffer.length > MAX_UPLOAD_BYTES) throw badRequest('Image must be 8 MB or smaller');
  if (!MAGIC.some((entry) => entry.test(buffer))) {
    throw badRequest('Unsupported image format. Upload a JPEG, PNG or WebP file.');
  }

  const pipeline = sharp(buffer, { failOn: 'error' }).rotate();
  const metadata = await pipeline.metadata();
  if (!metadata.width || !metadata.height) throw badRequest('Could not read image dimensions');

  const display = await pipeline
    .clone()
    .resize({ width: DISPLAY_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  const thumbnail = await pipeline
    .clone()
    .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 75, mozjpeg: true })
    .toBuffer();

  const resized = await sharp(display).metadata();

  return {
    display,
    thumbnail,
    width: resized.width ?? metadata.width,
    height: resized.height ?? metadata.height,
    contentType: 'image/jpeg',
    extension: 'jpg',
  };
}
