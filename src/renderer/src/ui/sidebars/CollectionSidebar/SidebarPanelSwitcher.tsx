import type { JSX } from 'react';
import type { RegisteredSidebarPanel } from '#/shared/plugin/types';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { setActiveSidebarPanel } from '#/renderer/src/store/slices/navigationSlice';

interface Props {
  /**
   * Switchable sidebar panel contributions from plugins.
   */
  panels: RegisteredSidebarPanel[];

  /**
   * Id of the active plugin panel, or null for the built-in Collections view.
   */
  activePanelId: string | null;
}

/**
 * Tab-like nav for switching between the built-in Collections view and plugin
 * sidebar panels. Renders nothing when no plugin panels are contributed.
 */
export function SidebarPanelSwitcher({ panels, activePanelId }: Props): JSX.Element | null {
  const dispatch = useAppDispatch();

  if (panels.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Sidebar panels"
      className="flex shrink-0 flex-wrap gap-1 border-b border-separator px-2 py-1.5"
    >
      <button
        type="button"
        className={`rounded px-2 py-1 text-[13px] app-no-drag ${
          activePanelId == null
            ? 'bg-accent/15 font-medium text-accent'
            : 'text-muted hover:bg-control hover:text-text'
        }`}
        aria-pressed={activePanelId == null}
        onClick={() => dispatch(setActiveSidebarPanel(null))}
      >
        Collections
      </button>
      {panels.map((panel) => (
        <button
          key={panel.id}
          type="button"
          className={`rounded px-2 py-1 text-[13px] app-no-drag ${
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
