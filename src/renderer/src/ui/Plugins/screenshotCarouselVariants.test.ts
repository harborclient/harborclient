import { describe, expect, it } from 'vitest';
import {
  screenshotCarouselImageFrameClassName,
  screenshotCarouselLightboxEnabled
} from '#/renderer/src/ui/Plugins/screenshotCarouselVariants';

describe('screenshotCarouselImageFrameClassName', () => {
  it('applies max-height containment for tab variant screenshots', () => {
    const className = screenshotCarouselImageFrameClassName('tab');

    expect(className).toContain('max-h-[min(18rem,35vh)]');
    expect(className).toContain('object-contain');
  });

  it('keeps aspect-video sizing for modal variant screenshots', () => {
    const className = screenshotCarouselImageFrameClassName('modal');

    expect(className).toContain('aspect-video');
    expect(className).toContain('object-cover');
  });
});

describe('screenshotCarouselLightboxEnabled', () => {
  it('enables lightbox for tab and modal variants', () => {
    expect(screenshotCarouselLightboxEnabled('tab')).toBe(true);
    expect(screenshotCarouselLightboxEnabled('modal')).toBe(true);
    expect(screenshotCarouselLightboxEnabled('card')).toBe(false);
  });
});
