import { RoundButton, Sidebar } from '@harborclient/sdk/components';
import { useCallback, type JSX } from 'react';
import { faXmark } from '#/renderer/src/fontawesome';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { closeLiveServerModal } from '#/renderer/src/store/slices/modalsSlice';
import {
  selectLiveServerLogsPlacement,
  selectSidebarPlacement,
  setShowLiveServerLogs,
  toggleLiveServerLogsPlacement
} from '#/renderer/src/store/slices/navigationSlice';
import { LiveServerLogsHeaderActions } from '#/renderer/src/ui/Footer/LiveServerLogsPanel/LiveServerLogsHeaderActions';
import { LiveServerLogsView } from '#/renderer/src/ui/Footer/LiveServerLogsPanel/LiveServerLogsView';
import { useLiveServerLogsController } from '#/renderer/src/ui/Footer/LiveServerLogsPanel/useLiveServerLogsController';

/**
 * Docked host for the live-server logs viewer.
 *
 * Mirrors the footer logs chrome (title, Clear / AI, dock toggle, close) and
 * mounts the shared {@link LiveServerLogsView} when placement is sidebar.
 * Side follows the opposite edge of the collections sidebar.
 *
 * @returns Resizable sidebar with streaming server logs.
 */
export function LiveServerLogsSidebar(): JSX.Element {
  const dispatch = useAppDispatch();
  const placement = useAppSelector(selectLiveServerLogsPlacement);
  const sidebarPlacement = useAppSelector(selectSidebarPlacement);
  const controller = useLiveServerLogsController();

  /**
   * Docks the open logs viewer back into the footer and remembers it for this server.
   *
   * Closes the live-server editor when moving to the footer so both do not compete
   * for the same slide-up host.
   */
  const handleTogglePlacement = useCallback((): void => {
    dispatch(toggleLiveServerLogsPlacement(controller.savedId));
    dispatch(closeLiveServerModal());
  }, [controller.savedId, dispatch]);

  /**
   * Closes the logs viewer without changing the persisted dock placement.
   */
  const handleClose = useCallback((): void => {
    dispatch(setShowLiveServerLogs(false));
  }, [dispatch]);

  return (
    <Sidebar
      side={sidebarPlacement === 'left' ? 'right' : 'left'}
      ariaLabel="Live server logs"
      scroll={false}
      storageKey="hc.liveServerLogsSidebarWidth"
      defaultSize={360}
      minSize={280}
      getMaxSize={() => 720}
      resizeAriaLabel="Resize live server logs sidebar"
      header={
        <div className="flex shrink-0 items-center justify-between border-b border-separator px-3 py-2">
          <div className="min-w-0">
            <div className="flex min-w-0 items-baseline gap-2 font-medium text-text">
              <span className="truncate">Logs: {controller.serverName}</span>
              <span className="text-muted truncate text-[14px] font-normal">
                {controller.statusLabel}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <LiveServerLogsHeaderActions
              aiAvailable={controller.aiAvailable}
              liveServerUuid={controller.liveServerUuid}
              canClear={controller.canClear}
              placement={placement}
              onAddLogsToChat={controller.handleAddLogsToChat}
              onClear={controller.handleClear}
              onTogglePlacement={handleTogglePlacement}
            />
            <RoundButton
              icon={faXmark}
              title="Close"
              ariaLabel="Close live server logs"
              onClick={handleClose}
            />
          </div>
        </div>
      }
    >
      <LiveServerLogsView
        query={controller.query}
        onQueryChange={controller.setQuery}
        matchOptions={controller.matchOptions}
        onMatchOptionsChange={controller.setMatchOptions}
        invalidRegex={controller.invalidRegex}
        filteredRows={controller.filteredRows}
        isRunning={controller.isRunning}
        noServerSelected={controller.sessionId == null}
        filterActive={controller.filterActive}
        hiddenCount={controller.hiddenCount}
        liveServerUuid={controller.liveServerUuid}
        serverName={controller.serverName}
      />
    </Sidebar>
  );
}
