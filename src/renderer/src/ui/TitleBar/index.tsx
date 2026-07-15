import type { JSX } from 'react';
import { isLinux, isMac } from '#/renderer/src/platform';
import { LinuxTitleBar } from './LinuxTitleBar';

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
