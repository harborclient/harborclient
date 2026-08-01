import { FooterPanel } from '@harborclient/sdk/components';
import { useCallback, useMemo, type JSX } from 'react';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectLiveServerLogsPlacement,
  toggleLiveServerLogsPlacement
} from '#/renderer/src/store/slices/navigationSlice';
import { LiveServerLogsHeaderActions } from './LiveServerLogsHeaderActions';
import { LiveServerLogsView } from './LiveServerLogsView';
import { useLiveServerLogsController } from './useLiveServerLogsController';

interface Props {
  /**
   * Whether the panel is visible (slides up when true).
   */
  open: boolean;

  /**
   * Closes the live-server logs panel.
   */
  onClose: () => void;
}

/**
 * Slide-up, resizable footer panel streaming Express request logs for one session.
 *
 * Hosts the shared {@link LiveServerLogsView} when docked to the footer. Use the
 * dock control to move the same viewer into the right sidebar.
 *
 * @param props - Open state and close handler.
 * @returns Footer panel with terminal-style access log.
 */
export function LiveServerLogsPanel({ open, onClose }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const placement = useAppSelector(selectLiveServerLogsPlacement);
  const controller = useLiveServerLogsController();

  /**
   * Docks the open logs viewer into the right sidebar and remembers it for this server.
   */
  const handleTogglePlacement = useCallback((): void => {
    dispatch(toggleLiveServerLogsPlacement(controller.savedId));
  }, [controller.savedId, dispatch]);

  /**
   * Header actions: AI, Clear, and dock-to-sidebar (close comes from FooterPanel).
   */
  const headerButtons = useMemo(
    () => [
      <LiveServerLogsHeaderActions
        key="actions"
        aiAvailable={controller.aiAvailable}
        liveServerUuid={controller.liveServerUuid}
        canClear={controller.canClear}
        placement={placement}
        onAddLogsToChat={controller.handleAddLogsToChat}
        onClear={controller.handleClear}
        onTogglePlacement={handleTogglePlacement}
      />
    ],
    [controller, handleTogglePlacement, placement]
  );

  return (
    <FooterPanel
      id="footer-live-server-logs-panel"
      open={open}
      onClose={onClose}
      closeLabel="live server logs"
      storageKey="hc.liveServerLogsHeight"
      title={
        <span className="inline-flex min-w-0 items-baseline gap-2">
          <span className="truncate">Logs: {controller.serverName}</span>
          <span className="text-muted truncate text-[14px] font-normal">
            {controller.statusLabel}
          </span>
        </span>
      }
      buttons={headerButtons}
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
    </FooterPanel>
  );
}
