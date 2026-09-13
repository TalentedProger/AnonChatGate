import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { InvalidImageError, sanitizeImage } from '../image-upload';

async function createPng(): Promise<Buffer> {
  return sharp({
    create: {
      width: 2,
      height: 2,
      channels: 4,
      background: { r: 40, g: 120, b: 200, alpha: 0.5 },
    },
  }).png().toBuffer();
}

describe('sanitizeImage', () => {
  it('decodes and re-encodes a raster image as WebP', async () => {
    const output = await sanitizeImage(await createPng());
    const metadata = await sharp(output).metadata();

    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(2);
    expect(metadata.height).toBe(2);
  });

  it('removes an HTML/script payload appended to a valid image', async () => {
    const payload = '<script>globalThis.stolenToken=true</script>';
    const polyglot = Buffer.concat([await createPng(), Buffer.from(payload)]);

    const output = await sanitizeImage(polyglot);

    expect(output.includes(Buffer.from(payload))).toBe(false);
    expect(await sharp(output).metadata()).toMatchObject({ format: 'webp' });
  });

  it('rejects HTML even when a client claims it is an image', async () => {
    await expect(sanitizeImage(Buffer.from('<!doctype html><script>alert(1)</script>')))
      .rejects.toBeInstanceOf(InvalidImageError);
  });

  it('rejects active SVG content even though Sharp can decode SVG', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10"/></svg>',
    );

    await expect(sanitizeImage(svg)).rejects.toBeInstanceOf(InvalidImageError);
  });
});
