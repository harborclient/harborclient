import { useCallback, useEffect, useMemo, type JSX } from 'react';
import { useMcpServerStatus } from '#/renderer/src/hooks/useMcpServerStatus';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectBrowserTabWithSettingsOpen,
  selectConsoleEntries
} from '#/renderer/src/store/selectors';
import { clearConsole } from '#/renderer/src/store/slices/consoleSlice';
import {
  closeLiveServerModal,
  selectLiveServerModal
} from '#/renderer/src/store/slices/modalsSlice';
import {
  selectActivePluginFooterPanelId,
  selectLiveServerLogsFooterOpen,
  selectShowConsole,
  selectShowMcp,
  selectShowTerminal,
  selectShowVariables,
  setShowLiveServerLogs,
  setShowMcp,
  toggleConsole,
  toggleMcp,
  togglePluginFooterPanel,
  toggleTerminal,
  toggleVariables
} from '#/renderer/src/store/slices/navigationSlice';
import { setBrowserSettingsPanelOpen } from '#/renderer/src/store/slices/tabsSlice';
import { usePluginFooterPanels } from '#/renderer/src/plugins/pluginHooks';
import { ConsolePanel } from './ConsolePanel';
import { LivePageSettingsPanel } from './LivePageSettingsPanel';
import { LiveServerLogsPanel } from './LiveServerLogsPanel';
import { LiveServerPanel } from './LiveServerPanel';
import { McpPanel } from './McpPanel';
import { HostedFooterPanel } from './HostedFooterPanel';
import { VariablesPanel } from './VariablesPanel';
import { TerminalPanel } from './TerminalPanel';
import { useActiveScopedVariables } from './useActiveScopedVariables';
import { resolveScopedVariables } from './VariablesPanel/resolve';

/**
 * Slide-up footer panels anchored to the bottom of the main content column so
 * they span between the sidebars instead of the full app window width.
 *
 * Owns panel open state, console entries, scoped variables, and exclusive-close
 * handling so the app shell can render `<FooterPanels />` with no props.
 */
export function FooterPanels(): JSX.Element {
  const dispatch = useAppDispatch();
  const mcpServerStatus = useMcpServerStatus();
  const { refresh: refreshMcpServerStatus } = mcpServerStatus;
  const {
    globalVariables,
    collectionVariables,
    folderVariables,
    environmentVariables,
    collectionName,
    folderName,
    environmentName
  } = useActiveScopedVariables();
  const pluginFooterPanels = usePluginFooterPanels();
  const activePluginFooterPanelId = useAppSelector(selectActivePluginFooterPanelId);
  const liveServerModal = useAppSelector(selectLiveServerModal);
  const settingsBrowserTab = useAppSelector(selectBrowserTabWithSettingsOpen);
  const consoleOpen = useAppSelector(selectShowConsole);
  const entries = useAppSelector(selectConsoleEntries);
  const variablesOpen = useAppSelector(selectShowVariables);
  const showMcp = useAppSelector(selectShowMcp);
  const terminalOpen = useAppSelector(selectShowTerminal);
  const liveServerLogsOpen = useAppSelector(selectLiveServerLogsFooterOpen);
  const liveServerOpen = liveServerModal != null;
  const livePageSettingsOpen = settingsBrowserTab != null;
  const mcpOpen = showMcp && mcpServerStatus.enabled;

  /**
   * Merges scoped variables for the variables panel content.
   */
  const resolvedVariables = useMemo(
    () =>
      resolveScopedVariables(
        globalVariables,
        collectionVariables,
        folderVariables,
        environmentVariables
      ),
    [globalVariables, collectionVariables, folderVariables, environmentVariables]
  );

  /**
   * Closes the MCP footer panel when the feature is disabled in Settings.
   */
  useEffect(() => {
    if (!mcpServerStatus.enabled && showMcp) {
      dispatch(setShowMcp(false));
    }
  }, [dispatch, mcpServerStatus.enabled, showMcp]);

  /**
   * Closes the live server editor when another footer panel is toggled open.
   */
  const closeLiveServerEditor = useCallback((): void => {
    dispatch(closeLiveServerModal());
  }, [dispatch]);

  /**
   * Closes the live page settings panel when another footer panel is toggled open.
   */
  const closeLivePageSettings = useCallback((): void => {
    if (settingsBrowserTab == null) {
      return;
    }
    dispatch(setBrowserSettingsPanelOpen({ tabId: settingsBrowserTab.tabId, open: false }));
  }, [dispatch, settingsBrowserTab]);

  /**
   * Closes exclusive editors, then toggles the console panel.
   */
  const handleToggleConsole = useCallback((): void => {
    closeLiveServerEditor();
    closeLivePageSettings();
    dispatch(toggleConsole());
  }, [closeLivePageSettings, closeLiveServerEditor, dispatch]);

  /**
   * Closes exclusive editors, then toggles the variables panel.
   */
  const handleToggleVariables = useCallback((): void => {
    closeLiveServerEditor();
    closeLivePageSettings();
    dispatch(toggleVariables());
  }, [closeLivePageSettings, closeLiveServerEditor, dispatch]);

  /**
   * Closes exclusive editors, then toggles the MCP panel.
   */
  const handleToggleMcp = useCallback((): void => {
    closeLiveServerEditor();
    closeLivePageSettings();
    dispatch(toggleMcp());
  }, [closeLivePageSettings, closeLiveServerEditor, dispatch]);

  /**
   * Closes exclusive editors, then toggles the terminal panel.
   */
  const handleToggleTerminal = useCallback((): void => {
    closeLiveServerEditor();
    closeLivePageSettings();
    dispatch(toggleTerminal());
  }, [closeLivePageSettings, closeLiveServerEditor, dispatch]);

  /**
   * Clears all console entries.
   */
  const handleClearConsole = useCallback((): void => {
    dispatch(clearConsole());
  }, [dispatch]);

  /**
   * Closes the live-server logs slide-up panel.
   */
  const handleCloseLiveServerLogs = useCallback((): void => {
    dispatch(setShowLiveServerLogs(false));
  }, [dispatch]);

  /**
   * Refreshes MCP server runtime status after panel saves.
   */
  const handleMcpStatusChange = useCallback((): void => {
    void refreshMcpServerStatus();
  }, [refreshMcpServerStatus]);

  /**
   * Closes the live server editor panel when not busy.
   */
  const handleCloseLiveServer = useCallback((): void => {
    if (liveServerModal?.busy) {
      return;
    }
    closeLiveServerEditor();
  }, [closeLiveServerEditor, liveServerModal?.busy]);

  /**
   * Closes the live page settings footer panel.
   */
  const handleCloseLivePageSettings = useCallback((): void => {
    closeLivePageSettings();
  }, [closeLivePageSettings]);

  return (
    <div className="absolute inset-x-0 bottom-0">
      {liveServerOpen ? (
        <LiveServerPanel open onClose={handleCloseLiveServer} />
      ) : livePageSettingsOpen && settingsBrowserTab != null ? (
        <LivePageSettingsPanel
          open
          browserTab={settingsBrowserTab}
          onClose={handleCloseLivePageSettings}
        />
      ) : (
        <>
          <ConsolePanel
            entries={entries}
            open={consoleOpen}
            onClose={handleToggleConsole}
            onClear={handleClearConsole}
          />
          <VariablesPanel
            variables={resolvedVariables}
            open={variablesOpen}
            onClose={handleToggleVariables}
            collectionName={collectionName}
            folderName={folderName}
            environmentName={environmentName}
          />
          <McpPanel
            open={mcpOpen}
            onClose={handleToggleMcp}
            onStatusChange={handleMcpStatusChange}
          />
          <TerminalPanel open={terminalOpen} onClose={handleToggleTerminal} />
          {liveServerLogsOpen ? (
            <LiveServerLogsPanel open onClose={handleCloseLiveServerLogs} />
          ) : null}
          {pluginFooterPanels.map((panel) => (
            <HostedFooterPanel
              key={panel.id}
              id={panel.id}
              pluginId={panel.pluginId}
              contributionId={panel.contributionId}
              title={panel.title}
              open={activePluginFooterPanelId === panel.id}
              onClose={() => {
                closeLiveServerEditor();
                closeLivePageSettings();
                dispatch(togglePluginFooterPanel(panel.id));
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}
