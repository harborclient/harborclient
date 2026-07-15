import type { JSX } from 'react';
import { LinuxMenuBar } from './LinuxMenuBar';
import { LinuxWindowControls } from './LinuxWindowControls';

const APP_TITLE = 'HarborClient';

/**
 * Linux frameless title bar: menu bar on the left, centered title, window controls on the right.
 */
export function LinuxTitleBar(): JSX.Element {
  return (
    <header
      className="flex h-9 shrink-0 items-center border-b border-separator bg-surface app-drag"
      onDoubleClick={() => void window.api.toggleMaximizeWindow()}
    >
      <div className="flex flex-1 items-center">
        <LinuxMenuBar />
      </div>
      <span className="pointer-events-none truncate px-3 text-[14px] text-text-secondary">
        {APP_TITLE}
      </span>
      <div className="flex flex-1 justify-end">
        <LinuxWindowControls />
      </div>
    </header>
  );
}
