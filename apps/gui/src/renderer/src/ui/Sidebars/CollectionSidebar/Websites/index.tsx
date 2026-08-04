import {
  EmptySectionLabel,
  RowActionsMenu,
  SidebarListbox,
  SidebarWebsiteItem
} from '@harborclient/sdk/components';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type MouseEvent
} from 'react';
import type { Website } from '@harborclient/core/types';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectAllWebsites } from '#/renderer/src/store/selectors';
import { isBrowserTab } from '#/renderer/src/store/tabs';
import {
  deleteWebsite,
  exportWebsite,
  openWebsite,
  openWebsiteSettings
} from '#/renderer/src/store/thunks/websites';
import { faGlobe } from '#/renderer/src/fontawesome';
import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/useSidebarExpansion';
import { buildCopyIdMenuItem } from '#/renderer/src/ui/Sidebars/CollectionSidebar/menus/copyEntityId';
import {
  sortSidebarItems,
  toSortTimestamp
} from '#/renderer/src/ui/Sidebars/CollectionSidebar/sort/sidebarSort';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/Modals/dialogHelpers';
import { useSidebarProviders } from '#/renderer/src/ui/Sidebars/CollectionSidebar/providers/sidebarProvidersContext';

/** Delay before single-click opens a live page so double-click can open settings instead. */
const LIVE_PAGE_OPEN_CLICK_DELAY_MS = 250;

/**
 * Websites sidebar section listing saved embedded browser tabs with open, edit, copy-id, export, and delete actions.
 */
export function Websites(): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const allWebsites = useAppSelector(selectAllWebsites);
  const tabs = useAppSelector((state) => state.tabs.tabs);
  const activeTabId = useAppSelector((state) => state.tabs.activeTabId);
  const { sectionSort, showStorageLocationBadges } = useSidebarExpansion();
  const { primaryConnectionId, connectionNamesById } = useSidebarProviders();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const openClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sortMode = sectionSort.websites;

  /**
   * Clears any pending delayed open so double-click can open settings alone.
   */
  const cancelPendingOpen = useCallback((): void => {
    if (openClickTimerRef.current == null) {
      return;
    }
    clearTimeout(openClickTimerRef.current);
    openClickTimerRef.current = null;
  }, []);

  /**
   * Clears a pending open timer when the Live Pages section unmounts.
   */
  useEffect(() => {
    return () => {
      cancelPendingOpen();
    };
  }, [cancelPendingOpen]);

  /**
   * Websites ordered by the Websites section sort mode.
   */
  const websites = useMemo(() => {
    return sortSidebarItems(allWebsites, sortMode, {
      name: (website) => website.name,
      createdAt: (website) => toSortTimestamp(website.createdAt)
    });
  }, [allWebsites, sortMode]);

  /**
   * Website id linked to the active browser tab, if any.
   */
  const activeWebsiteId = useMemo(() => {
    const active = tabs.find((tab) => tab.tabId === activeTabId);
    return active && isBrowserTab(active) ? active.websiteId : null;
  }, [activeTabId, tabs]);

  /**
   * Deletes one website after confirmation.
   *
   * @param website - Website to trash.
   */
  const handleDelete = useCallback(
    async (website: Website): Promise<void> => {
      const confirmed = await confirm({
        title: 'Delete live page',
        message: `Move “${website.name}” to the trash?`,
        confirmLabel: 'Delete',
        variant: 'danger'
      });
      if (!confirmed) {
        return;
      }
      try {
        await dispatch(deleteWebsite(website.id)).unwrap();
      } catch (error) {
        showAlert(dispatch, formatErrorMessage(error, 'Failed to delete live page'));
      }
    },
    [confirm, dispatch]
  );

  /**
   * Opens a website in a browser tab.
   *
   * @param website - Website to open.
   */
  const handleOpen = useCallback(
    (website: Website): void => {
      void dispatch(openWebsite(website.id));
    },
    [dispatch]
  );

  /**
   * Schedules opening a live page after a short delay so double-click can cancel it.
   *
   * @param website - Website to open.
   */
  const scheduleOpen = useCallback(
    (website: Website): void => {
      cancelPendingOpen();
      openClickTimerRef.current = setTimeout(() => {
        openClickTimerRef.current = null;
        handleOpen(website);
      }, LIVE_PAGE_OPEN_CLICK_DELAY_MS);
    },
    [cancelPendingOpen, handleOpen]
  );

  /**
   * Opens a website and shows its webpage settings page.
   *
   * @param website - Website whose scripts/settings to edit.
   */
  const handleEdit = useCallback(
    (website: Website): void => {
      cancelPendingOpen();
      void dispatch(openWebsiteSettings(website.id));
    },
    [cancelPendingOpen, dispatch]
  );

  return (
    <div className="flex flex-col gap-0.5 px-1 pb-1">
      {websites.length === 0 ? <EmptySectionLabel label="No live pages" /> : null}
      {websites.length > 0 ? (
        <SidebarListbox aria-label="Live pages">
          {websites.map((website) => {
            const menuId = `website-${website.id}`;
            const selected = activeWebsiteId === website.id;
            const connectionName = connectionNamesById[website.connectionId ?? primaryConnectionId];
            const openTab = tabs.find(
              (tab) => isBrowserTab(tab) && tab.websiteId === website.id && tab.faviconDataUrl
            );
            const faviconDataUrl =
              (openTab && isBrowserTab(openTab) ? openTab.faviconDataUrl : null) ??
              website.faviconDataUrl;
            return (
              <SidebarWebsiteItem
                key={website.id}
                name={website.name}
                faviconDataUrl={faviconDataUrl}
                fallbackIcon={faGlobe}
                connectionBadge={
                  showStorageLocationBadges && connectionName != null ? connectionName : undefined
                }
                selected={selected}
                actions={
                  <RowActionsMenu
                    menuId={menuId}
                    openMenuId={openMenuId}
                    onOpenChange={setOpenMenuId}
                    triggerTabIndex={-1}
                    groups={[
                      [
                        {
                          label: 'Edit',
                          onSelect: () => {
                            handleEdit(website);
                          }
                        },
                        buildCopyIdMenuItem(website.uuid),
                        {
                          label: 'Export',
                          onSelect: () => {
                            void dispatch(exportWebsite(website.id));
                          }
                        }
                      ],
                      [
                        {
                          label: 'Delete',
                          variant: 'danger',
                          onSelect: () => {
                            void handleDelete(website);
                          }
                        }
                      ]
                    ]}
                  />
                }
                onClick={(event: MouseEvent) => {
                  event.preventDefault();
                  // Ignore the second click of a double-click so only settings open.
                  if (event.detail > 1) {
                    cancelPendingOpen();
                    return;
                  }
                  scheduleOpen(website);
                }}
                onDoubleClick={(event: MouseEvent) => {
                  event.preventDefault();
                  handleEdit(website);
                }}
                onContextMenu={(event: MouseEvent) => {
                  event.preventDefault();
                  setOpenMenuId(menuId);
                }}
                onEnter={() => handleOpen(website)}
              />
            );
          })}
        </SidebarListbox>
      ) : null}
    </div>
  );
}
