import type { JSX, MouseEvent } from 'react';
import type { RootMenuLabel } from '#/shared/types';

const ROOT_MENU_LABELS: RootMenuLabel[] = ['File', 'Edit', 'View', 'Help'];

const menuButtonClass =
  'cursor-pointer rounded-sm border-none bg-transparent px-2.5 py-1 text-sm text-text hover:bg-selection app-no-drag';

/**
 * Opens a root application submenu below the clicked menu bar button.
 *
 * @param label - Root menu label to open.
 * @param event - Click event from the menu bar button.
 */
function openSubmenu(label: RootMenuLabel, event: MouseEvent<HTMLButtonElement>): void {
  const rect = event.currentTarget.getBoundingClientRect();
  void window.api.popupMenuSubmenu(label, rect.left, rect.bottom);
}

/**
 * In-app menu bar for frameless Linux windows where the OS does not render File/Edit/View/Help.
 */
export function LinuxMenuBar(): JSX.Element {
  return (
    <nav
      aria-label="Application menu"
      role="menubar"
      className="flex shrink-0 items-center px-1 app-no-drag"
    >
      {ROOT_MENU_LABELS.map((label) => (
        <button
          key={label}
          type="button"
          role="menuitem"
          aria-haspopup="menu"
          className={menuButtonClass}
          onClick={(event) => openSubmenu(label, event)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
