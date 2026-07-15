import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type MouseEvent
} from 'react';
import { formatAcceleratorDisplay } from '#/shared/shortcuts';
import {
  resolveSkipNavigationLinks,
  SKIP_NAVIGATION_ID,
  type SkipNavigationVisibility
} from '#/renderer/src/ui/Shared/SkipNavigation/skipNavigationTargets';
import {
  focusSkipNavigation,
  focusSkipNavigationOnLaunch,
  focusSkipTarget
} from '#/renderer/src/ui/Shared/SkipNavigation/skipNavigationInitialFocus';

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

/** Default accelerator shown beside Main nav when shortcut settings cannot load. */
const DEFAULT_MAIN_NAV_ACCELERATOR = 'F4';

/** Shared focus styling for each skip link in the navigation menu. */
const skipLinkClass =
  'rounded-md px-3 py-2 text-[14px] text-text hover:bg-selection focus:outline focus:outline-2 focus:outline-accent';

/**
 * Shell classes for the skip menu. The menu stays clipped out of view until focus
 * lands on the nav container or one of its links (keyboard Tab or the main-nav shortcut).
 */
const skipNavShellClass = [
  'absolute left-2 top-2 z-[100] flex flex-col gap-1 rounded-md bg-surface p-2',
  'outline-none focus:outline focus:outline-2 focus:outline-accent focus:shadow-md',
  'has-[:focus]:outline has-[:focus]:outline-2 has-[:focus]:outline-accent has-[:focus]:shadow-md',
  '[&:not(:focus):not(:has(:focus))]:h-px [&:not(:focus):not(:has(:focus))]:w-px',
  '[&:not(:focus):not(:has(:focus))]:overflow-hidden',
  '[&:not(:focus):not(:has(:focus))]:p-0',
  '[&:not(:focus):not(:has(:focus))]:[clip-path:inset(50%)]',
  '[&:not(:focus):not(:has(:focus))]:whitespace-nowrap'
].join(' ');

/**
 * Capitalizes each segment of a settings-style accelerator string for inline display.
 *
 * @param display - Lowercase hyphen-separated accelerator from {@link formatAcceleratorDisplay}.
 * @returns Display string such as `F4` or `Ctrl-Shift-N`.
 */
function capitalizeShortcutDisplay(display: string): string {
  return display
    .split('-')
    .map((part) => {
      if (/^f\d+$/i.test(part)) {
        return part.toUpperCase();
      }

      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('-');
}

/**
 * Formats an Electron accelerator for the Main nav shortcut hint beside the link.
 *
 * @param accelerator - Electron accelerator string for the focus-main-nav binding.
 * @returns Human-readable key label such as `F4`.
 */
function formatMainNavShortcutLabel(accelerator: string): string {
  return capitalizeShortcutDisplay(formatAcceleratorDisplay(accelerator));
}

/**
 * Visually hidden skip navigation menu that appears when a link receives keyboard focus.
 * Lets keyboard users jump directly to major UI regions without tabbing through chrome.
 */
export function SkipNavigation({ visibility, onOpenShortcuts }: Props): JSX.Element {
  const launchAnchorRef = useRef<HTMLDivElement>(null);
  const initialFocusAppliedRef = useRef(false);
  const [mainNavShortcutLabel, setMainNavShortcutLabel] = useState(
    formatMainNavShortcutLabel(DEFAULT_MAIN_NAV_ACCELERATOR)
  );

  /**
   * Derives the skip links that match currently visible layout regions.
   */
  const links = useMemo(() => resolveSkipNavigationLinks(visibility), [visibility]);

  /**
   * Loads the configured focus-main-nav accelerator for the Main nav shortcut hint.
   */
  useEffect(() => {
    let cancelled = false;

    window.api
      .getShortcuts()
      .then((bindings) => {
        if (cancelled) {
          return;
        }

        const mainNavBinding = bindings.find((binding) => binding.id === 'focus-main-nav');
        if (mainNavBinding == null) {
          return;
        }

        setMainNavShortcutLabel(formatMainNavShortcutLabel(mainNavBinding.accelerator));
      })
      .catch(() => {
        // Keep the default label when shortcut settings cannot be loaded.
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

  /**
   * Moves focus to a skip target without native fragment scrolling that breaks layout.
   */
  const handleSkipLinkActivate = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, targetId: string): void => {
      event.preventDefault();
      if (targetId === SKIP_NAVIGATION_ID) {
        focusSkipNavigation();
        return;
      }

      focusSkipTarget(targetId);
    },
    []
  );

  return (
    <>
      <div ref={launchAnchorRef} tabIndex={-1} className="sr-only" aria-hidden="true" />
      <nav
        id={SKIP_NAVIGATION_ID}
        tabIndex={-1}
        aria-label="Skip navigation"
        className={skipNavShellClass}
      >
        <a
          href={`#${SKIP_NAVIGATION_ID}`}
          className={skipLinkClass}
          onClick={(event) => handleSkipLinkActivate(event, SKIP_NAVIGATION_ID)}
        >
          <span className="inline-flex items-center gap-2">
            <span>Main nav</span>
            <kbd className="rounded bg-control px-1.5 py-0.5 font-mono text-[14px] text-muted">
              {mainNavShortcutLabel}
            </kbd>
          </span>
        </a>
        {links.map((link) => (
          <a
            key={link.id}
            href={`#${link.targetId}`}
            className={skipLinkClass}
            onClick={(event) => handleSkipLinkActivate(event, link.targetId)}
          >
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
