import { useEffect, useMemo, useRef, type JSX } from 'react';
import {
  resolveSkipNavigationLinks,
  SKIP_NAVIGATION_ID,
  type SkipNavigationVisibility
} from '#/renderer/src/ui/shared/skipNavigationTargets';
import { focusSkipNavigationOnLaunch } from '#/renderer/src/ui/shared/skipNavigationInitialFocus';

interface Props {
  /**
   * Current panel visibility used to filter skip links.
   */
  visibility: SkipNavigationVisibility;

  /**
   * Opens the read-only keyboard shortcuts reference modal.
   */
  onOpenShortcuts: () => void;
}

/** Maximum animation frames to retry launch focus before giving up. */
const INITIAL_FOCUS_MAX_ATTEMPTS = 12;

/** Shared focus styling for each skip link in the navigation menu. */
const skipLinkClass =
  'rounded-md px-3 py-2 text-[14px] text-text hover:bg-selection focus:outline focus:outline-2 focus:outline-accent';

/**
 * Shell classes for the skip menu. The menu stays clipped out of view until a
 * keyboard focus-visible event lands on the nav container or one of its links.
 */
const skipNavShellClass = [
  'absolute left-2 top-2 z-[100] flex flex-col gap-1 rounded-md bg-surface p-2',
  'outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:shadow-md',
  'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent has-[:focus-visible]:shadow-md',
  '[&:not(:focus-visible):not(:has(:focus-visible))]:h-px [&:not(:focus-visible):not(:has(:focus-visible))]:w-px',
  '[&:not(:focus-visible):not(:has(:focus-visible))]:overflow-hidden',
  '[&:not(:focus-visible):not(:has(:focus-visible))]:p-0',
  '[&:not(:focus-visible):not(:has(:focus-visible))]:[clip-path:inset(50%)]',
  '[&:not(:focus-visible):not(:has(:focus-visible))]:whitespace-nowrap'
].join(' ');

/**
 * Visually hidden skip navigation menu that appears when a link receives keyboard focus.
 * Lets keyboard users jump directly to major UI regions without tabbing through chrome.
 */
export function SkipNavigation({ visibility, onOpenShortcuts }: Props): JSX.Element {
  const launchAnchorRef = useRef<HTMLDivElement>(null);
  const initialFocusAppliedRef = useRef(false);

  /**
   * Derives the skip links that match currently visible layout regions.
   */
  const links = useMemo(() => resolveSkipNavigationLinks(visibility), [visibility]);

  /**
   * Focuses a neutral launch anchor once on startup so Tab order starts at skip
   * navigation without revealing the menu until the first Tab press.
   */
  useEffect(() => {
    if (initialFocusAppliedRef.current) {
      return;
    }

    let cancelled = false;
    let attempts = 0;

    /**
     * Retries focusing the launch anchor until it mounts or a blocking modal appears.
     */
    const tryFocus = (): void => {
      if (cancelled) {
        return;
      }

      const result = focusSkipNavigationOnLaunch(
        launchAnchorRef.current,
        initialFocusAppliedRef.current
      );

      if (result === 'applied') {
        initialFocusAppliedRef.current = true;
        return;
      }

      if (result === 'stop') {
        return;
      }

      attempts += 1;
      if (attempts >= INITIAL_FOCUS_MAX_ATTEMPTS) {
        initialFocusAppliedRef.current = true;
        return;
      }

      requestAnimationFrame(tryFocus);
    };

    requestAnimationFrame(tryFocus);

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <div ref={launchAnchorRef} tabIndex={-1} className="sr-only" aria-hidden="true" />
      <nav
        id={SKIP_NAVIGATION_ID}
        tabIndex={-1}
        aria-label="Skip navigation"
        className={skipNavShellClass}
      >
        <a href={`#${SKIP_NAVIGATION_ID}`} className={skipLinkClass}>
          Main nav
        </a>
        {links.map((link) => (
          <a key={link.id} href={`#${link.targetId}`} className={skipLinkClass}>
            {link.label}
          </a>
        ))}
        <button type="button" className={skipLinkClass} onClick={onOpenShortcuts}>
          Shortcuts
        </button>
      </nav>
    </>
  );
}
