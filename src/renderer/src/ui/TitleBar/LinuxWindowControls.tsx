import { FaIcon } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { faMinus, faWindowMaximize, faXmark } from '#/renderer/src/fontawesome';

const controlButtonClass =
  'inline-flex h-9 w-10 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent text-muted hover:bg-selection hover:text-text app-no-drag';

const closeButtonClass =
  'inline-flex h-9 w-10 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent text-muted hover:bg-danger/15 hover:text-danger app-no-drag';

/**
 * Minimize, maximize, and close buttons for frameless Linux window chrome.
 */
export function LinuxWindowControls(): JSX.Element {
  return (
    <div className="flex shrink-0 app-no-drag">
      <button
        type="button"
        className={controlButtonClass}
        aria-label="Minimize"
        onClick={() => void window.api.minimizeWindow()}
      >
        <FaIcon icon={faMinus} className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={controlButtonClass}
        aria-label="Maximize"
        onClick={() => void window.api.toggleMaximizeWindow()}
      >
        <FaIcon icon={faWindowMaximize} className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={closeButtonClass}
        aria-label="Close"
        onClick={() => void window.api.closeWindow()}
      >
        <FaIcon icon={faXmark} className="h-4 w-4" />
      </button>
    </div>
  );
}
