import { FaIcon } from '@harborclient/sdk/components';
import type { JSX, KeyboardEvent, MouseEvent } from 'react';
import { useState } from 'react';

import { faAngleLeft, faAngleRight } from '#/renderer/src/fontawesome';
import { ScreenshotLightbox } from './ScreenshotLightbox';

interface Props {
  /**
   * Resolved screenshot URLs or data URLs to display.
   */
  images: string[];

  /**
   * Visual context for card grid vs detail modal spacing.
   */
  variant: 'card' | 'modal';

  /**
   * Optional wrapper class names.
   */
  className?: string;

  /**
   * Stops pointer and keyboard events from bubbling to a parent activator.
   * Used by marketplace cards that open a modal on click.
   */
  stopPropagation?: boolean;
}

/**
 * Returns the image frame classes for card and modal variants.
 *
 * @param variant - Card grid or detail modal layout.
 */
function imageFrameClassName(variant: Props['variant']): string {
  const base = 'aspect-video w-full object-cover object-top';
  if (variant === 'card') {
    return `${base} border-b border-separator`;
  }
  return `${base} rounded-md border border-separator`;
}

/**
 * Accessible left/right screenshot carousel for plugin marketplace previews.
 */
export function ScreenshotCarousel({
  images,
  variant,
  className,
  stopPropagation = false
}: Props): JSX.Element | null {
  const [index, setIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const imageCount = images.length;
  const currentIndex = imageCount === 0 ? 0 : Math.min(index, imageCount - 1);

  if (imageCount === 0) {
    return null;
  }

  const hasMultiple = imageCount > 1;
  const currentImage = images[currentIndex];
  const lightboxEnabled = variant === 'modal';

  /**
   * Moves to the previous screenshot, wrapping to the last slide.
   */
  const showPrevious = (): void => {
    setIndex(currentIndex === 0 ? imageCount - 1 : currentIndex - 1);
  };

  /**
   * Moves to the next screenshot, wrapping to the first slide.
   */
  const showNext = (): void => {
    setIndex(currentIndex === imageCount - 1 ? 0 : currentIndex + 1);
  };

  /**
   * Handles keyboard navigation within the carousel group.
   *
   * @param event - Keyboard event on the carousel container.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!hasMultiple) {
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showPrevious();
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      showNext();
    }
  };

  /**
   * Prevents carousel controls from activating a parent card click handler.
   *
   * @param event - Pointer event from a carousel control.
   */
  const handleControlPointerEvent = (event: MouseEvent<HTMLButtonElement>): void => {
    if (stopPropagation) {
      event.stopPropagation();
    }
  };

  /**
   * Prevents carousel keyboard activation from opening a parent card.
   *
   * @param event - Keyboard event from a carousel control.
   */
  const handleControlKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (stopPropagation) {
      event.stopPropagation();
    }
  };

  /**
   * Opens the full-size screenshot lightbox in the plugin detail modal.
   */
  const handleOpenLightbox = (): void => {
    setLightboxOpen(true);
  };

  const frameClassName = imageFrameClassName(variant);
  const previewLabel = hasMultiple
    ? `View screenshot ${currentIndex + 1} of ${imageCount} in full size`
    : 'View screenshot in full size';

  return (
    <div
      className={className ?? 'relative'}
      role="group"
      aria-roledescription="carousel"
      aria-label="Plugin screenshots"
      tabIndex={hasMultiple ? 0 : undefined}
      onKeyDown={handleKeyDown}
    >
      {lightboxEnabled ? (
        <button
          type="button"
          className="mb-4 block w-full cursor-zoom-in border-none bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-label={previewLabel}
          onClick={handleOpenLightbox}
        >
          <img src={currentImage} alt="" aria-hidden className={frameClassName} />
        </button>
      ) : (
        <img src={currentImage} alt="" aria-hidden className={frameClassName} />
      )}

      {lightboxEnabled && lightboxOpen ? (
        <ScreenshotLightbox
          images={images}
          index={currentIndex}
          onIndexChange={setIndex}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}

      {hasMultiple ? (
        <>
          <button
            type="button"
            className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md border border-separator bg-panel/90 text-text shadow-sm hover:bg-selection focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
            aria-label="Previous screenshot"
            onClick={(event) => {
              handleControlPointerEvent(event);
              showPrevious();
            }}
            onKeyDown={handleControlKeyDown}
          >
            <FaIcon icon={faAngleLeft} className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md border border-separator bg-panel/90 text-text shadow-sm hover:bg-selection focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
            aria-label="Next screenshot"
            onClick={(event) => {
              handleControlPointerEvent(event);
              showNext();
            }}
            onKeyDown={handleControlKeyDown}
          >
            <FaIcon icon={faAngleRight} className="h-3.5 w-3.5" />
          </button>

          <p className="sr-only" role="status" aria-live="polite">
            {`Screenshot ${currentIndex + 1} of ${imageCount}`}
          </p>

          <div
            className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5"
            aria-hidden
          >
            {images.map((image, dotIndex) => (
              <span
                key={`${image}-${dotIndex}`}
                className={`h-2 w-2 rounded-full ${dotIndex === currentIndex ? 'bg-text' : 'bg-text/40'}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
