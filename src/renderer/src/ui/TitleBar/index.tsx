import type { JSX } from 'react';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { faMinus, faWindowMaximize, faXmark } from '#/renderer/src/fontawesome';
import { isLinux, isMac } from '#/renderer/src/platform';
import { LinuxMenuBar } from '#/renderer/src/ui/TitleBar/LinuxMenuBar';

const APP_TITLE = 'HarborClient';

const controlButtonClass =
  'inline-flex h-9 w-10 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent text-muted hover:bg-selection hover:text-text app-no-drag';

const closeButtonClass =
  'inline-flex h-9 w-10 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent text-muted hover:bg-danger/15 hover:text-danger app-no-drag';

/**
 * Minimize, maximize, and close buttons for frameless Linux window chrome.
 */
function LinuxWindowControls(): JSX.Element {
  return (
    <div className="flex shrink-0 app-no-drag">
      <button
        type="button"
        className={controlButtonClass}
        aria-label="Minimize"
        onClick={() => void window.api.minimizeWindow()}
      >
        <FaIcon icon={faMinus} className="h-3 w-3" />
      </button>
      <button
        type="button"
        className={controlButtonClass}
        aria-label="Maximize"
        onClick={() => void window.api.toggleMaximizeWindow()}
      >
        <FaIcon icon={faWindowMaximize} className="h-3 w-3" />
      </button>
      <button
        type="button"
        className={closeButtonClass}
        aria-label="Close"
        onClick={() => void window.api.closeWindow()}
      >
        <FaIcon icon={faXmark} className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/**
 * Linux frameless title bar: menu bar on the left, centered title, window controls on the right.
 */
function LinuxTitleBar(): JSX.Element {
  return (
    <header
      className="flex h-9 shrink-0 items-center border-b border-separator bg-surface app-drag"
      onDoubleClick={() => void window.api.toggleMaximizeWindow()}
    >
      <div className="flex flex-1 items-center">
        <LinuxMenuBar />
      </div>
      <span className="pointer-events-none truncate px-3 text-sm text-text-secondary">
        {APP_TITLE}
      </span>
      <div className="flex flex-1 justify-end">
        <LinuxWindowControls />
      </div>
    </header>
  );
}

/**
 * macOS hidden-inset drag region, or Linux frameless title bar with menu bar and window controls.
 */
export function TitleBar(): JSX.Element | null {
  if (isMac) {
    return <div className="app-drag h-[52px] shrink-0" aria-hidden="true" />;
  }

  if (isLinux) {
    return <LinuxTitleBar />;
  }

  return null;
}
