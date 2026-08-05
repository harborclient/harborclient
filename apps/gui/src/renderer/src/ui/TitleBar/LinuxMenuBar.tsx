import { useCallback, useState, type JSX, type MouseEvent } from 'react';
import type { AppSubmenuItemSnapshot, RootMenuLabel } from '@harborclient/core/types';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectActiveBrowserTab } from '#/renderer/src/store/selectors';
import {
  coverBrowserGuestForOverlay,
  uncoverBrowserGuest
} from '#/renderer/src/ui/Main/RequestEditor/BrowserTab/browserGuestCover';
import { hasBrowserGuest } from '#/renderer/src/ui/Main/RequestEditor/BrowserTab/browserGuestRegistry';
import { LinuxAppSubmenu } from './LinuxAppSubmenu';

const ROOT_MENU_LABELS: RootMenuLabel[] = ['File', 'Edit', 'View', 'Team', 'Git', 'Help'];

const menuButtonClass =
  'cursor-pointer rounded-sm border-none bg-transparent px-2.5 py-1 text-text hover:bg-selection';

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
  const activeBrowserTab = useAppSelector(selectActiveBrowserTab);

  /**
   * Freezes and hides the active live-page guest so the HTML menu can paint above it.
   */
  const coverActiveBrowserGuest = useCallback(async (): Promise<void> => {
    if (!activeBrowserTab || !hasBrowserGuest(activeBrowserTab.tabId)) {
      return;
    }
    await coverBrowserGuestForOverlay(activeBrowserTab.tabId, 'linux-menu');
  }, [activeBrowserTab]);

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

      // Cover before painting the menu so WebContentsView never occludes the dropdown.
      if (openMenu === null) {
        await coverActiveBrowserGuest();
      }

      setOpenMenu({
        label,
        items,
        position: { x: rect.left, y: rect.bottom }
      });
    },
    [coverActiveBrowserGuest, openMenu]
  );

  /**
   * Closes any open renderer submenu and restores the live-page guest.
   */
  const closeSubmenu = useCallback((): void => {
    setOpenMenu(null);
    void uncoverBrowserGuest('linux-menu');
  }, []);

  return (
    <>
      <nav aria-label="Application menu" role="menubar" className="flex shrink-0 items-center px-1">
        {ROOT_MENU_LABELS.map((label) => (
          <button
            key={label}
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={openMenu?.label === label}
            className={menuButtonClass}
            onMouseDown={(event) => {
              // Keep the submenu outside-click handler from closing before this
              // button can toggle or switch menus (avoids a WebContentsView flash).
              event.stopPropagation();
            }}
            onClick={(event) => {
              if (openMenu?.label === label) {
                closeSubmenu();
                return;
              }
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
