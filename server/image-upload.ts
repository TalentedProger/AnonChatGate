import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ALLOWED_INPUT_FORMATS = new Set(['jpeg', 'png', 'gif', 'webp']);
const MAX_FRAME_COUNT = 60;
const MAX_TOTAL_PIXELS = 40_000_000;
const MAX_OUTPUT_DIMENSION = 4096;

export class InvalidImageError extends Error {
  constructor(message = 'Invalid image content') {
    super(message);
    this.name = 'InvalidImageError';
  }
}

function assertSafeMetadata(metadata: sharp.Metadata): void {
  if (!metadata.format || !ALLOWED_INPUT_FORMATS.has(metadata.format)) {
    throw new InvalidImageError('Unsupported image format');
  }

  if (!metadata.width || !metadata.height) {
    throw new InvalidImageError('Image dimensions are missing');
  }

  const pages = metadata.pages ?? 1;
  const pageHeight = metadata.pageHeight ?? metadata.height;
  const totalPixels = metadata.width * pageHeight * pages;

  if (pages > MAX_FRAME_COUNT || totalPixels > MAX_TOTAL_PIXELS) {
    throw new InvalidImageError('Image dimensions exceed the safety limit');
  }
}

/**
 * Decode an untrusted raster image and create a new WebP byte stream. Re-encoding
 * drops the client filename, extension, metadata and any bytes appended to the
 * original file, so uploaded content can never be served as active HTML/SVG.
 */
export async function sanitizeImage(input: Buffer): Promise<Buffer> {
  if (input.length === 0) {
    throw new InvalidImageError();
  }

  try {
    const options: sharp.SharpOptions = {
      animated: true,
      failOn: 'warning',
      limitInputPixels: MAX_TOTAL_PIXELS,
    };
    const metadata = await sharp(input, options).metadata();
    assertSafeMetadata(metadata);

    return await sharp(input, options)
      .rotate()
      .resize({
        width: MAX_OUTPUT_DIMENSION,
        height: MAX_OUTPUT_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 85, effort: 4 })
      .toBuffer();
  } catch (error) {
    if (error instanceof InvalidImageError) {
      throw error;
    }

    throw new InvalidImageError();
  }
}

export async function storeSanitizedImage(
  input: Buffer,
  uploadDirectory: string,
): Promise<{ filename: string; path: string }> {
  const sanitized = await sanitizeImage(input);
  const filename = `${crypto.randomUUID()}.webp`;
  const filePath = path.join(uploadDirectory, filename);

  await fs.mkdir(uploadDirectory, { recursive: true });
  await fs.writeFile(filePath, sanitized, { flag: 'wx', mode: 0o600 });

  return { filename, path: filePath };
}
