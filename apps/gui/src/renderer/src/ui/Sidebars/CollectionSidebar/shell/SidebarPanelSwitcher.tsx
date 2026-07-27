import type { JSX } from 'react';
import type { RegisteredSidebarPanel } from '@harborclient/core/plugin/types';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { setActiveSidebarPanel } from '#/renderer/src/store/slices/navigationSlice';

interface Props {
  /**
   * Non-replacing plugin panels shown as switchable destinations.
   * When no collections replacement is active, this is typically all plugin panels.
   */
  panels: RegisteredSidebarPanel[];

  /**
   * Id of the active plugin panel, or null for the primary collections surface.
   */
  activePanelId: string | null;

  /**
   * Winning panel that replaces the built-in Collections sidebar, if any.
   * When set, the primary tab uses this panel's title instead of "Collections".
   */
  collectionsReplacement?: RegisteredSidebarPanel | null;

  /**
   * When false, the switcher is not rendered (no destinations to switch between).
   */
  showSwitcher?: boolean;
}

/**
 * Tab-like nav for switching between the primary collections surface and plugin
 * sidebar panels. Renders nothing when there is nothing to switch to.
 *
 * Without a collections replacement, the primary tab is labeled "Collections".
 * With a replacement, the primary tab uses the replacement panel's title and
 * still dispatches `null` (primary surface).
 */
export function SidebarPanelSwitcher({
  panels,
  activePanelId,
  collectionsReplacement = null,
  showSwitcher = true
}: Props): JSX.Element | null {
  const dispatch = useAppDispatch();

  if (!showSwitcher) {
    return null;
  }

  if (collectionsReplacement == null && panels.length === 0) {
    return null;
  }

  const primaryTitle = collectionsReplacement?.title ?? 'Collections';
  const primaryIcon = collectionsReplacement?.icon;

  return (
    <nav
      aria-label="Sidebar panels"
      className="flex shrink-0 flex-wrap gap-1 border-b border-separator px-2 py-1.5"
    >
      <button
        type="button"
        className={`rounded px-2 py-1 text-[14px] app-no-drag ${
          activePanelId == null
            ? 'bg-accent/15 font-medium text-accent'
            : 'text-muted hover:bg-control hover:text-text'
        }`}
        aria-pressed={activePanelId == null}
        title={primaryTitle}
        onClick={() => dispatch(setActiveSidebarPanel(null))}
      >
        {primaryIcon ? (
          <span aria-hidden="true" className="mr-1">
            {primaryIcon}
          </span>
        ) : null}
        {primaryTitle}
      </button>
      {panels.map((panel) => (
        <button
          key={panel.id}
          type="button"
          className={`rounded px-2 py-1 text-[14px] app-no-drag ${
            activePanelId === panel.id
              ? 'bg-accent/15 font-medium text-accent'
              : 'text-muted hover:bg-control hover:text-text'
          }`}
          aria-pressed={activePanelId === panel.id}
          title={panel.title}
          onClick={() => dispatch(setActiveSidebarPanel(panel.id))}
        >
          {panel.icon ? (
            <span aria-hidden="true" className="mr-1">
              {panel.icon}
            </span>
          ) : null}
          {panel.title}
        </button>
      ))}
    </nav>
  );
}
