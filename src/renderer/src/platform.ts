import type { OperatingSystemInfo } from '#/shared/types';

/**
 * True when running on macOS.
 */
export const isMac = window.platform === 'darwin';

/**
 * True when running on Linux (including ChromeOS Crostini).
 */
export const isLinux = window.platform === 'linux';

/**
 * True when the renderer paints custom title bar chrome instead of the OS frame.
 */
export const hasCustomTitleBar = isMac || isLinux;

/**
 * Returns a root layout class name for platform-specific chrome spacing.
 *
 * @returns Platform class for the app shell, or an empty string on Windows.
 */
export function platformClassName(): string {
  if (isMac) return 'platform-darwin';
  if (isLinux) return 'platform-linux';
  return '';
}

/**
 * Returns host operating system metadata exposed from the preload bridge.
 *
 * @returns Platform, type, release, and CPU architecture for the local machine.
 */
export function getOperatingSystemInfo(): OperatingSystemInfo {
  return window.operatingSystemInfo;
}
