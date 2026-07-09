/**
 * Screenshot carousel layout variant.
 */
export type ScreenshotCarouselVariant = 'card' | 'modal' | 'tab';

/**
 * Returns the image frame classes for card, modal, and tab variants.
 *
 * @param variant - Card grid, detail modal, or page tab layout.
 */
export function screenshotCarouselImageFrameClassName(variant: ScreenshotCarouselVariant): string {
  if (variant === 'card') {
    return 'aspect-video w-full object-cover object-top border-b border-separator';
  }
  if (variant === 'tab') {
    return 'max-h-[min(18rem,35vh)] w-full rounded-md border border-separator object-contain object-top';
  }
  return 'aspect-video w-full object-cover object-top rounded-md border border-separator';
}

/**
 * Returns whether the carousel should open a full-size lightbox on click.
 *
 * @param variant - Card grid, detail modal, or page tab layout.
 */
export function screenshotCarouselLightboxEnabled(variant: ScreenshotCarouselVariant): boolean {
  return variant === 'modal' || variant === 'tab';
}
