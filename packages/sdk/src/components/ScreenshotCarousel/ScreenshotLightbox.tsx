import { faAngleLeft, faAngleRight } from '@fortawesome/free-solid-svg-icons';
import type { JSX, KeyboardEvent } from 'react';
import { useEffect } from 'react';
import { FaIcon } from '../FaIcon/index.js';
import { Modal } from '../Modal/index.js';

interface Props {
  /**
   * Resolved screenshot URLs or data URLs shown in the lightbox.
   */
  images: string[];

  /**
   * Active slide index shared with the carousel preview.
   */
  index: number;

  /**
   * Updates the active slide when the user navigates inside the lightbox.
   */
  onIndexChange: (index: number) => void;

  /**
   * Closes the lightbox overlay.
   */
  onClose: () => void;

  /**
   * Accessible name for the lightbox dialog.
   */
  label?: string;
}

/** Shared prev/next control styling for carousel and lightbox navigation. */
const NAV_BUTTON_CLASS =
  'flex h-8 w-8 items-center justify-center rounded-md border border-separator bg-panel/90 text-text shadow-sm hover:bg-selection focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none';

/**
 * Full-size screenshot preview dialog opened from a screenshot carousel.
 */
export function ScreenshotLightbox({
  images,
  index,
  onIndexChange,
  onClose,
  label = 'Screenshot preview'
}: Props): JSX.Element {
  const imageCount = images.length;
  const currentIndex = Math.min(index, imageCount - 1);
  const hasMultiple = imageCount > 1;
  const currentImage = images[currentIndex];

  /**
   * Closes the lightbox on Escape without dismissing a parent dialog beneath it.
   */
  useEffect(() => {
    /**
     * Handles Escape in the capture phase so nested modals stay open.
     *
     * @param event - Document keydown event.
     */
    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  /**
   * Moves to the previous screenshot, wrapping to the last slide.
   */
  const showPrevious = (): void => {
    onIndexChange(currentIndex === 0 ? imageCount - 1 : currentIndex - 1);
  };

  /**
   * Moves to the next screenshot, wrapping to the first slide.
   */
  const showNext = (): void => {
    onIndexChange(currentIndex === imageCount - 1 ? 0 : currentIndex + 1);
  };

  /**
   * Handles keyboard navigation within the lightbox dialog.
   *
   * @param event - Keyboard event on the lightbox container.
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

  return (
    <Modal
      label={label}
      onClose={onClose}
      disableEscape
      overlayClassName="z-[60]"
      className="relative flex max-h-[90vh] w-[min(92vw,72rem)] items-center justify-center p-2"
    >
      <div className="relative flex w-full items-center justify-center" onKeyDown={handleKeyDown}>
        <img src={currentImage} alt="" className="max-h-[85vh] max-w-full object-contain" />

        {hasMultiple ? (
          <>
            <button
              type="button"
              className={`absolute top-1/2 left-2 -translate-y-1/2 ${NAV_BUTTON_CLASS}`}
              aria-label="Previous screenshot"
              onClick={showPrevious}
            >
              <FaIcon icon={faAngleLeft} className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              className={`absolute top-1/2 right-2 -translate-y-1/2 ${NAV_BUTTON_CLASS}`}
              aria-label="Next screenshot"
              onClick={showNext}
            >
              <FaIcon icon={faAngleRight} className="h-3.5 w-3.5" />
            </button>

            <p className="sr-only" role="status" aria-live="polite">
              {`Screenshot ${currentIndex + 1} of ${imageCount}`}
            </p>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
