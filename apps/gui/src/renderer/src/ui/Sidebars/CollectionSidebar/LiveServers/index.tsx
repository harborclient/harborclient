import {
  EmptySectionLabel,
  FaIcon,
  RowActionsMenu,
  SidebarItem,
  SidebarStatusDot,
  SIDEBAR_ITEM_BUTTON_CLASS
} from '@harborclient/sdk/components';
import {
  useCallback,
  useMemo,
  useState,
  type JSX,
  type KeyboardEvent,
  type MouseEvent
} from 'react';
import type { LiveServer, RunningLiveServer } from '@harborclient/core/types';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectRunningLiveServers, selectSavedLiveServers } from '#/renderer/src/store/selectors';
import { openLiveServerModal } from '#/renderer/src/store/slices/modalsSlice';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import {
  deleteSavedLiveServer,
  openLiveServerInBrowser,
  reportLiveServerError,
  startLiveServer,
  stopLiveServer,
  toLiveServerConfig
} from '#/renderer/src/store/thunks/liveServers';
import { faServer } from '#/renderer/src/fontawesome';
import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/useSidebarExpansion';
import { buildCopyIdMenuItem } from '#/renderer/src/ui/Sidebars/CollectionSidebar/menus/copyEntityId';
import {
  sortSidebarItems,
  toSortTimestamp
} from '#/renderer/src/ui/Sidebars/CollectionSidebar/sort/sidebarSort';

/**
 * Live Servers section listing saved configs with running/stopped status.
 */
export function LiveServers(): JSX.Element {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const allSaved = useAppSelector(selectSavedLiveServers);
  const running = useAppSelector(selectRunningLiveServers);
  const { sectionSort } = useSidebarExpansion();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const sortMode = sectionSort.liveServers;

  /**
   * Saved servers ordered by the Live Servers section sort mode.
   */
  const saved = useMemo(() => {
    return sortSidebarItems(allSaved, sortMode, {
      name: (server) => server.name,
      createdAt: (server) => toSortTimestamp(server.createdAt)
    });
  }, [allSaved, sortMode]);

  /**
   * Running instance keyed by saved live server id.
   */
  const runningBySavedId = useMemo(() => {
    const map = new Map<number, RunningLiveServer>();
    for (const server of running) {
      if (server.savedId != null) {
        map.set(server.savedId, server);
      }
    }
    return map;
  }, [running]);

  /**
   * Starts a saved live server and opens a browser tab.
   *
   * @param server - Saved config to start.
   */
  const handleStart = useCallback(
    async (server: LiveServer): Promise<void> => {
      try {
        await dispatch(
          startLiveServer({
            savedId: server.id,
            config: toLiveServerConfig({
              name: server.name,
              root: server.root,
              port: server.port,
              aliases: server.aliases,
              watch: server.watch,
              cors: server.cors
            })
          })
        ).unwrap();
      } catch (error) {
        reportLiveServerError(dispatch, error, 'Failed to start live server');
      }
    },
    [dispatch]
  );

  /**
   * Opens the running server origin in a browser tab.
   *
   * @param instance - Running instance to open.
   */
  const handleOpen = useCallback(
    (instance: RunningLiveServer): void => {
      dispatch(openLiveServerInBrowser(instance.origin, instance.id));
    },
    [dispatch]
  );

  /**
   * Opens the edit modal for a saved live server.
   *
   * @param server - Saved config to edit.
   */
  const handleEdit = useCallback(
    (server: LiveServer): void => {
      dispatch(
        openLiveServerModal({
          mode: 'edit',
          savedId: server.id,
          name: server.name,
          root: server.root,
          port: server.port,
          aliases: server.aliases,
          watch: server.watch,
          cors: server.cors
        })
      );
    },
    [dispatch]
  );

  /**
   * Stops a running live server after confirmation.
   *
   * @param server - Saved config whose running instance should stop.
   * @param instance - Runtime instance to stop.
   */
  const handleStop = useCallback(
    async (server: LiveServer, instance: RunningLiveServer): Promise<void> => {
      const confirmed = await confirm({
        title: 'Stop live server',
        message: `Stop “${server.name}” on port ${instance.port}?`,
        confirmLabel: 'Stop',
        variant: 'danger'
      });
      if (!confirmed) {
        return;
      }
      try {
        await dispatch(stopLiveServer(instance.id)).unwrap();
      } catch (error) {
        reportLiveServerError(dispatch, error, 'Failed to stop live server');
      }
    },
    [confirm, dispatch]
  );

  /**
   * Deletes a saved live server after confirmation.
   *
   * @param server - Saved config to delete.
   */
  const handleDelete = useCallback(
    async (server: LiveServer): Promise<void> => {
      const confirmed = await confirm({
        title: 'Delete live server',
        message: `Delete “${server.name}”? Running instances are not stopped.`,
        confirmLabel: 'Delete',
        variant: 'danger'
      });
      if (!confirmed) {
        return;
      }
      try {
        await dispatch(deleteSavedLiveServer(server.id)).unwrap();
      } catch (error) {
        reportLiveServerError(dispatch, error, 'Failed to delete live server');
      }
    },
    [confirm, dispatch]
  );

  return (
    <div className="flex flex-col gap-0.5 px-1 pb-1">
      {saved.length === 0 ? <EmptySectionLabel label="No live servers" /> : null}
      {saved.map((server) => {
        const menuId = `live-server-${server.id}`;
        const instance = runningBySavedId.get(server.id);
        const isRunning = instance != null;
        const portLabel = isRunning
          ? instance.origin
          : server.port != null
            ? `:${server.port}`
            : 'auto port';
        const subtitle = `${server.root} · ${portLabel}`;
        const statusLabel = isRunning ? 'Running' : 'Stopped';

        /**
         * Starts or opens the server when Enter is pressed on the row.
         *
         * @param event - Keyboard event from the listbox option.
         */
        const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
          if (event.key !== 'Enter') {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          if (instance != null) {
            handleOpen(instance);
            return;
          }
          void handleStart(server);
        };

        return (
          <SidebarItem
            key={server.id}
            selected={false}
            onContextMenu={(event: MouseEvent) => {
              event.preventDefault();
              setOpenMenuId(menuId);
            }}
            listboxOption={{
              ariaLabel: `${server.name}, ${statusLabel}, ${subtitle}`,
              onClick: (event: MouseEvent) => {
                event.preventDefault();
                if (instance != null) {
                  handleOpen(instance);
                  return;
                }
                void handleStart(server);
              },
              onKeyDown: handleKeyDown
            }}
            actions={
              <RowActionsMenu
                menuId={menuId}
                openMenuId={openMenuId}
                onOpenChange={setOpenMenuId}
                groups={[
                  [
                    isRunning
                      ? {
                          label: 'Open',
                          onSelect: () => {
                            if (instance != null) {
                              handleOpen(instance);
                            }
                          }
                        }
                      : {
                          label: 'Start',
                          onSelect: () => {
                            void handleStart(server);
                          }
                        },
                    {
                      label: 'Edit',
                      onSelect: () => {
                        handleEdit(server);
                      }
                    },
                    {
                      label: 'Logs',
                      onSelect: () => {
                        dispatch(
                          openPageTab({
                            type: 'live-server-logs',
                            savedId: server.id
                          })
                        );
                      }
                    },
                    buildCopyIdMenuItem(server.uuid)
                  ],
                  [
                    ...(isRunning
                      ? [
                          {
                            label: 'Stop',
                            variant: 'danger' as const,
                            onSelect: () => {
                              if (instance != null) {
                                void handleStop(server, instance);
                              }
                            }
                          }
                        ]
                      : []),
                    {
                      label: 'Delete',
                      variant: 'danger',
                      onSelect: () => {
                        void handleDelete(server);
                      }
                    }
                  ]
                ]}
              />
            }
          >
            <span className={`${SIDEBAR_ITEM_BUTTON_CLASS} gap-2 rounded-md px-2 py-1`}>
              <SidebarStatusDot
                className={isRunning ? 'bg-success' : 'bg-danger'}
                title={statusLabel}
                srOnlyLabel={statusLabel}
              />
              <FaIcon icon={faServer} className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
              <span className="min-w-0 flex-1 truncate">
                <span className="block truncate">{server.name}</span>
                <span className="text-muted block truncate text-[14px]">{subtitle}</span>
              </span>
            </span>
          </SidebarItem>
        );
      })}
    </div>
  );
}
