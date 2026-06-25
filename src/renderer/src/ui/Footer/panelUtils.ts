import type { RefObject } from 'react';

/** Default slide-up footer panel height in pixels. */
export const DEFAULT_HEIGHT = 280;

/** Minimum slide-up footer panel height in pixels. */
export const MIN_HEIGHT = 120;

/**
 * Resolves the main workspace row above the footer for max-height measurement.
 *
 * Prefers the flex row wrapping `#main-content` so measurement stays correct
 * when the app shell includes skip links or other elements before the workspace.
 *
 * @param containerRef - Ref attached to the panel root element.
 * @returns Workspace row element, if found.
 */
function resolveFooterPanelContentArea(
  containerRef: RefObject<HTMLDivElement | null>
): HTMLElement | undefined {
  const mainContentParent = document.getElementById('main-content')?.parentElement;
  if (mainContentParent instanceof HTMLElement) {
    return mainContentParent;
  }

  const shell = containerRef.current?.parentElement?.parentElement;
  if (!(shell instanceof HTMLElement)) {
    return undefined;
  }

  for (const child of shell.children) {
    if (child instanceof HTMLElement && child.classList.contains('min-h-0')) {
      return child;
    }
  }

  return undefined;
}

/**
 * Computes the maximum height for a footer slide-up panel from the main content area.
 *
 * Walks from the panel container up to the app shell and measures the flex row
 * above the footer so panels cannot grow past the usable workspace.
 *
 * @param containerRef - Ref attached to the panel root element.
 * @returns Maximum panel height in pixels.
 */
export function getFooterPanelMaxSize(containerRef: RefObject<HTMLDivElement | null>): number {
  const contentArea = resolveFooterPanelContentArea(containerRef);
  if (!contentArea) return window.innerHeight * 0.8;
  return Math.max(MIN_HEIGHT, contentArea.clientHeight - 40);
}

/**
 * Builds slide-up footer panel class names for open/closed transform animation.
 *
 * @param open - Whether the panel is currently visible.
 * @returns Tailwind class string for the panel container.
 */
export function footerPanelClassName(open: boolean): string {
  return [
    'absolute inset-x-0 bottom-full z-40 flex flex-col border-t border-separator bg-surface',
    'shadow-[0_-4px_16px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-out app-no-drag',
    open ? 'translate-y-0' : 'translate-y-full pointer-events-none'
  ].join(' ');
}

/** Shared close-button styling for footer slide-up panels. */
export const footerPanelCloseButtonClassName =
  'inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-[14px] text-muted hover:bg-selection hover:text-text app-no-drag';
