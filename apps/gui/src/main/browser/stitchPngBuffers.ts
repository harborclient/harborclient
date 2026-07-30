import { Jimp } from 'jimp';

/**
 * Maximum total stitched height for a full-page screenshot (pixels).
 */
export const FULL_PAGE_SCREENSHOT_MAX_HEIGHT_PX = 16_000;

/**
 * Maximum number of viewport tiles allowed in a full-page capture.
 */
export const FULL_PAGE_SCREENSHOT_MAX_TILES = 40;

/**
 * Crops a PNG to a shorter height from the top edge (used for the last partial tile).
 *
 * @param png - Source PNG buffer.
 * @param height - Desired height in pixels (clamped to the image height).
 * @returns Cropped PNG buffer (or the original when no crop is needed).
 */
export async function cropPngToHeight(png: Buffer, height: number): Promise<Buffer> {
  const image = await Jimp.read(png);
  const targetHeight = Math.max(1, Math.min(image.height, Math.floor(height)));
  if (targetHeight >= image.height) {
    return png;
  }
  image.crop({ x: 0, y: 0, w: image.width, h: targetHeight });
  return Buffer.from(await image.getBuffer('image/png'));
}

/**
 * Computes how much of a tall page to capture given height and tile caps.
 *
 * @param pageHeight - Full document scroll height in CSS pixels.
 * @param viewportHeight - Visible viewport height in CSS pixels.
 * @returns Capture height, tile count, and whether the page was truncated.
 */
export function planFullPageCapture(
  pageHeight: number,
  viewportHeight: number
): { captureHeight: number; tileCount: number; truncated: boolean } {
  const safeViewport = Math.max(1, Math.floor(viewportHeight));
  const safePage = Math.max(safeViewport, Math.floor(pageHeight));
  let captureHeight = Math.min(safePage, FULL_PAGE_SCREENSHOT_MAX_HEIGHT_PX);
  let tileCount = Math.ceil(captureHeight / safeViewport);
  if (tileCount > FULL_PAGE_SCREENSHOT_MAX_TILES) {
    tileCount = FULL_PAGE_SCREENSHOT_MAX_TILES;
    captureHeight = Math.min(captureHeight, tileCount * safeViewport);
  }
  return {
    captureHeight,
    tileCount,
    truncated: captureHeight < safePage
  };
}

/**
 * Vertically stitches PNG buffers into a single PNG using jimp.
 *
 * Tiles are stacked top-to-bottom. The canvas width is the max tile width; shorter
 * tiles are left-aligned on a transparent background.
 *
 * @param tiles - PNG file buffers in top-to-bottom order.
 * @returns Combined PNG buffer.
 * @throws When `tiles` is empty or a tile cannot be decoded.
 */
export async function stitchPngBuffers(tiles: Buffer[]): Promise<Buffer> {
  if (tiles.length === 0) {
    throw new Error('Cannot stitch an empty screenshot tile list.');
  }

  const images = await Promise.all(tiles.map((tile) => Jimp.read(tile)));
  const width = Math.max(...images.map((image) => image.width));
  const height = images.reduce((sum, image) => sum + image.height, 0);

  const canvas = new Jimp({ width, height, color: 0x00000000 });
  let offsetY = 0;
  for (const image of images) {
    canvas.composite(image, 0, offsetY);
    offsetY += image.height;
  }

  return Buffer.from(await canvas.getBuffer('image/png'));
}
