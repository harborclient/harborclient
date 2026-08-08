import { describe, expect, it } from 'vitest';
import { AVATAR_JPEG_QUALITY, AVATAR_OUTPUT_SIZE } from './cropAvatarImage';

describe('cropAvatarImage constants', () => {
  it('exports the square output size and JPEG quality used by the cropper', () => {
    expect(AVATAR_OUTPUT_SIZE).toBe(256);
    expect(AVATAR_JPEG_QUALITY).toBeGreaterThan(0);
    expect(AVATAR_JPEG_QUALITY).toBeLessThanOrEqual(1);
  });
});
