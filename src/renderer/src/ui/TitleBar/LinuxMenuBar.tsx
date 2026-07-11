import { useCallback, useState, type JSX, type MouseEvent } from 'react';
import type { AppSubmenuItemSnapshot, RootMenuLabel } from '#/shared/types';
import { LinuxAppSubmenu } from '#/renderer/src/ui/TitleBar/LinuxAppSubmenu';

const ROOT_MENU_LABELS: RootMenuLabel[] = ['File', 'Edit', 'View', 'Team', 'Help'];

const menuButtonClass =
  'cursor-pointer rounded-sm border-none bg-transparent px-2.5 py-1 text-[16px] text-text hover:bg-selection app-no-drag';

interface OpenMenuState {
  /** Root menu label currently open. */
  label: RootMenuLabel;
  /** Snapshot entries for the open submenu. */
  items: AppSubmenuItemSnapshot[];
  /** Anchor position below the menu bar button. */
  position: { x: number; y: number };
}

/**
 * In-app menu bar for frameless Linux windows where the OS does not render File/Edit/View/Team/Help.
 *
 * Dropdowns are rendered in the renderer so they follow HarborClient theme tokens instead of
 * native GTK styling, which can remain dark even when nativeTheme is set to light.
 */
export function LinuxMenuBar(): JSX.Element {
  const [openMenu, setOpenMenu] = useState<OpenMenuState | null>(null);

  /**
   * Opens a themed renderer submenu below the clicked menu bar button.
   *
   * @param label - Root menu label to open.
   * @param event - Click event from the menu bar button.
   */
  const openSubmenu = useCallback(
    async (label: RootMenuLabel, event: MouseEvent<HTMLButtonElement>): Promise<void> => {
      const rect = event.currentTarget.getBoundingClientRect();
      const items = await window.api.getAppSubmenuSnapshot(label);

      setOpenMenu({
        label,
        items,
        position: { x: rect.left, y: rect.bottom }
      });
    },
    []
  );

  /**
   * Closes any open renderer submenu.
   */
  const closeSubmenu = useCallback((): void => {
    setOpenMenu(null);
  }, []);

  return (
    <>
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
            aria-expanded={openMenu?.label === label}
            className={menuButtonClass}
            onClick={(event) => {
              void openSubmenu(label, event);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {openMenu ? (
        <LinuxAppSubmenu
          label={openMenu.label}
          items={openMenu.items}
          position={openMenu.position}
          onClose={closeSubmenu}
        />
      ) : null}
    </>
  );
}
