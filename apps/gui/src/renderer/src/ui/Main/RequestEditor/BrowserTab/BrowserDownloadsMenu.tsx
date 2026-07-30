import {
  AnchorMenuPanel,
  RoundButton,
  getTriggerAnchoredMenuPosition,
  MENU_MIN_WIDTH_PX,
  type MenuItem,
  type MenuPosition
} from '@harborclient/sdk/components';
import type { BrowserDownloadEntry } from '@harborclient/core/types/api/browser';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type MouseEvent
} from 'react';
import { faDownload } from '#/renderer/src/fontawesome';
import { formatBytes } from '#/renderer/src/ui/Shared/responseFormatUtils';
import { coverBrowserGuestForOverlay, uncoverBrowserGuest } from './browserGuestCover';
import { hasBrowserGuest } from './browserGuestRegistry';

interface Props {
  /**
   * Browser tab id whose WebContentsView must be covered while the menu is open.
   */
  tabId: string;

  /**
   * Shared RoundButton sizing for browser chrome controls.
   */
  buttonClassName: string;

  /**
   * Shared icon sizing for browser chrome RoundButtons.
   */
  iconClassName: string;
}

/**
 * Live-page chrome control that lists recent browser downloads and reveals them in the OS folder.
 *
 * While open, freezes and hides the native guest so the portaled menu paints above it
 * (same pattern as the Linux app menu bar).
 *
 * @param props - Tab id and chrome button sizing classes.
 * @returns Downloads trigger and dropdown menu.
 */
export function BrowserDownloadsMenu({
  tabId,
  buttonClassName,
  iconClassName
}: Props): JSX.Element {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<MenuPosition | null>(null);
  const [downloads, setDownloads] = useState<BrowserDownloadEntry[]>([]);

  /**
   * Covers the live-page guest when needed, then opens the menu under the trigger.
   */
  const openMenu = useCallback(async (): Promise<void> => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    if (hasBrowserGuest(tabId)) {
      await coverBrowserGuestForOverlay(tabId);
    }
    setAnchor(
      getTriggerAnchoredMenuPosition(rect, {
        width: MENU_MIN_WIDTH_PX,
        height: 0
      })
    );
    setOpen(true);
  }, [tabId]);

  /**
   * Closes the menu and restores the covered guest viewport.
   */
  const closeMenu = useCallback((): void => {
    setOpen(false);
    setAnchor(null);
    void uncoverBrowserGuest();
  }, []);

  /**
   * Loads the current recent-downloads list and subscribes to download updates.
   * When the main process sets `autoOpen`, opens the menu to show the new item.
   */
  useEffect(() => {
    let cancelled = false;
    void window.api.browserListDownloads().then((list) => {
      if (!cancelled) {
        setDownloads(list);
      }
    });
    const unsubscribe = window.api.onBrowserDownloadsChanged((payload) => {
      setDownloads(payload.downloads);
      if (payload.autoOpen) {
        void openMenu();
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [openMenu]);

  /**
   * Restores the guest if this menu unmounts while still open (tab switch / teardown).
   */
  useEffect(() => {
    return () => {
      if (open) {
        void uncoverBrowserGuest();
      }
    };
  }, [open]);

  /**
   * Menu groups for the downloads dropdown: one row per file, or an empty-state placeholder.
   */
  const groups = useMemo((): MenuItem[][] => {
    if (downloads.length === 0) {
      return [[{ label: 'No file history', disabled: true, onSelect: () => undefined }]];
    }
    return [
      downloads.map((download) => {
        if (download.status === 'downloading') {
          return {
            label: `${download.fileName} · Downloading…`,
            disabled: true,
            onSelect: () => undefined
          };
        }
        return {
          label: `${download.fileName} · ${formatBytes(download.sizeBytes)}`,
          onSelect: () => {
            void window.api.showItemInFolder(download.filePath);
          }
        };
      })
    ];
  }, [downloads]);

  /**
   * Opens or closes the downloads menu, anchoring the panel under the trigger when opening.
   */
  function handleToggle(): void {
    if (open) {
      closeMenu();
      return;
    }
    void openMenu();
  }

  /**
   * Stops the portaled menu's document mousedown dismiss from racing the trigger toggle.
   *
   * @param event - Pointer down on the trigger while the menu is open.
   */
  function handleTriggerMouseDown(event: MouseEvent<HTMLButtonElement>): void {
    if (open) {
      event.stopPropagation();
    }
  }

  return (
    <div ref={triggerRef} className="relative">
      <RoundButton
        icon={faDownload}
        ariaLabel="Downloads"
        aria-haspopup="menu"
        aria-expanded={open}
        onMouseDown={handleTriggerMouseDown}
        onClick={handleToggle}
        className={buttonClassName}
        iconClassName={iconClassName}
      />
      {open && anchor ? (
        <AnchorMenuPanel
          menuId="browser-downloads"
          groups={groups}
          anchor={anchor}
          onDismiss={closeMenu}
        />
      ) : null}
    </div>
  );
}
