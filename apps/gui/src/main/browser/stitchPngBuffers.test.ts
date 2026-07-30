import { describe, expect, it } from 'vitest';
import { Jimp } from 'jimp';
import {
  cropPngToHeight,
  FULL_PAGE_SCREENSHOT_MAX_HEIGHT_PX,
  FULL_PAGE_SCREENSHOT_MAX_TILES,
  planFullPageCapture,
  stitchPngBuffers
} from './stitchPngBuffers';

/**
 * Builds a solid-color PNG buffer for stitch tests.
 *
 * @param width - Image width.
 * @param height - Image height.
 * @param color - RGBA packed color (e.g. `0xff0000ff`).
 * @returns PNG buffer.
 */
async function solidPng(width: number, height: number, color: number): Promise<Buffer> {
  const image = new Jimp({ width, height, color });
  return Buffer.from(await image.getBuffer('image/png'));
}

describe('stitchPngBuffers', () => {
  it('throws when given no tiles', async () => {
    await expect(stitchPngBuffers([])).rejects.toThrow('empty screenshot tile list');
  });

  it('stacks two tiles vertically', async () => {
    const top = await solidPng(8, 4, 0xff0000ff);
    const bottom = await solidPng(8, 6, 0x00ff00ff);
    const stitched = await stitchPngBuffers([top, bottom]);
    const result = await Jimp.read(stitched);
    expect(result.width).toBe(8);
    expect(result.height).toBe(10);
  });

  it('uses the max width when tiles differ', async () => {
    const narrow = await solidPng(4, 4, 0xff0000ff);
    const wide = await solidPng(12, 4, 0x0000ffff);
    const stitched = await stitchPngBuffers([narrow, wide]);
    const result = await Jimp.read(stitched);
    expect(result.width).toBe(12);
    expect(result.height).toBe(8);
  });
});

describe('cropPngToHeight', () => {
  it('crops a tall PNG to the requested height', async () => {
    const source = await solidPng(10, 20, 0xff0000ff);
    const cropped = await cropPngToHeight(source, 7);
    const result = await Jimp.read(cropped);
    expect(result.width).toBe(10);
    expect(result.height).toBe(7);
  });
});

describe('planFullPageCapture', () => {
  it('keeps short pages intact', () => {
    expect(planFullPageCapture(2400, 800)).toEqual({
      captureHeight: 2400,
      tileCount: 3,
      truncated: false
    });
  });

  it('truncates pages taller than the height cap', () => {
    const plan = planFullPageCapture(29_041, 800);
    expect(plan.truncated).toBe(true);
    expect(plan.captureHeight).toBe(FULL_PAGE_SCREENSHOT_MAX_HEIGHT_PX);
    expect(plan.tileCount).toBe(Math.ceil(FULL_PAGE_SCREENSHOT_MAX_HEIGHT_PX / 800));
  });

  it('also respects the tile cap', () => {
    const plan = planFullPageCapture(100_000, 200);
    expect(plan.truncated).toBe(true);
    expect(plan.tileCount).toBe(FULL_PAGE_SCREENSHOT_MAX_TILES);
    expect(plan.captureHeight).toBe(FULL_PAGE_SCREENSHOT_MAX_TILES * 200);
  });
});
