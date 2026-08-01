import { useCallback, useMemo, type JSX } from 'react';
import type { Variable } from '@harborclient/core/types';
import type { ConsoleEntry } from '#/renderer/src/store';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectBrowserTabWithSettingsOpen } from '#/renderer/src/store/selectors';
import {
  closeLiveServerModal,
  selectLiveServerModal
} from '#/renderer/src/store/slices/modalsSlice';
import {
  selectActivePluginFooterPanelId,
  togglePluginFooterPanel
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
import { resolveScopedVariables } from './VariablesPanel/resolve';

interface Props {
  /**
   * Whether the console panel is currently open.
   */
  consoleOpen: boolean;

  /**
   * Console log entries, newest first.
   */
  entries: ConsoleEntry[];

  /**
   * Toggles the console panel open/closed.
   */
  onToggleConsole: () => void;

  /**
   * Clears all console entries.
   */
  onClear: () => void;

  /**
   * Whether the variables panel is currently open.
   */
  variablesOpen: boolean;

  /**
   * Toggles the variables panel open/closed.
   */
  onToggleVariables: () => void;

  /**
   * Variables from app-wide global settings.
   */
  globalVariables: Variable[];

  /**
   * Variables from the active collection.
   */
  collectionVariables: Variable[];

  /**
   * Variables from the active folder.
   */
  folderVariables: Variable[];

  /**
   * Variables from the active environment.
   */
  environmentVariables: Variable[];

  /**
   * Name of the active collection, if any.
   */
  collectionName?: string;

  /**
   * Name of the active folder, if any.
   */
  folderName?: string;

  /**
   * Name of the active environment, if any.
   */
  environmentName?: string;

  /**
   * Whether the MCP server panel is currently open.
   */
  mcpOpen: boolean;

  /**
   * Toggles the MCP server panel open/closed.
   */
  onToggleMcp: () => void;

  /**
   * Whether the terminal panel is currently open.
   */
  terminalOpen: boolean;

  /**
   * Toggles the terminal panel open/closed.
   */
  onToggleTerminal: () => void;

  /**
   * Whether the live-server logs panel is currently open.
   */
  liveServerLogsOpen: boolean;

  /**
   * Closes the live-server logs panel (opened from a server row, not the footer bar).
   */
  onCloseLiveServerLogs: () => void;

  /**
   * Refreshes MCP server runtime status after panel saves.
   */
  onMcpStatusChange?: () => void;
}

/**
 * Slide-up footer panels anchored to the bottom of the main content column so
 * they span between the sidebars instead of the full app window width.
 */
export function FooterPanels({
  entries,
  consoleOpen,
  onToggleConsole,
  onClear,
  variablesOpen,
  onToggleVariables,
  globalVariables,
  collectionVariables,
  folderVariables,
  environmentVariables,
  collectionName,
  folderName,
  environmentName,
  mcpOpen,
  onToggleMcp,
  terminalOpen,
  onToggleTerminal,
  liveServerLogsOpen,
  onCloseLiveServerLogs,
  onMcpStatusChange
}: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const pluginFooterPanels = usePluginFooterPanels();
  const activePluginFooterPanelId = useAppSelector(selectActivePluginFooterPanelId);
  const liveServerModal = useAppSelector(selectLiveServerModal);
  const settingsBrowserTab = useAppSelector(selectBrowserTabWithSettingsOpen);
  const liveServerOpen = liveServerModal != null;
  const livePageSettingsOpen = settingsBrowserTab != null;

  /**
   * Merges scoped variables for the variables panel content.
   */
  const resolvedVariables = useMemo(
    () =>
      resolveScopedVariables(
        globalVariables ?? [],
        collectionVariables ?? [],
        folderVariables ?? [],
        environmentVariables ?? []
      ),
    [globalVariables, collectionVariables, folderVariables, environmentVariables]
  );

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
    onToggleConsole();
  }, [closeLivePageSettings, closeLiveServerEditor, onToggleConsole]);

  /**
   * Closes exclusive editors, then toggles the variables panel.
   */
  const handleToggleVariables = useCallback((): void => {
    closeLiveServerEditor();
    closeLivePageSettings();
    onToggleVariables();
  }, [closeLivePageSettings, closeLiveServerEditor, onToggleVariables]);

  /**
   * Closes exclusive editors, then toggles the MCP panel.
   */
  const handleToggleMcp = useCallback((): void => {
    closeLiveServerEditor();
    closeLivePageSettings();
    onToggleMcp();
  }, [closeLivePageSettings, closeLiveServerEditor, onToggleMcp]);

  /**
   * Closes exclusive editors, then toggles the terminal panel.
   */
  const handleToggleTerminal = useCallback((): void => {
    closeLiveServerEditor();
    closeLivePageSettings();
    onToggleTerminal();
  }, [closeLivePageSettings, closeLiveServerEditor, onToggleTerminal]);

  /**
   * Closes the live-server logs slide-up panel.
   */
  const handleCloseLiveServerLogs = useCallback((): void => {
    onCloseLiveServerLogs();
  }, [onCloseLiveServerLogs]);

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
            onClear={onClear}
          />
          <VariablesPanel
            variables={resolvedVariables}
            open={variablesOpen}
            onClose={handleToggleVariables}
            collectionName={collectionName}
            folderName={folderName}
            environmentName={environmentName}
          />
          <McpPanel open={mcpOpen} onClose={handleToggleMcp} onStatusChange={onMcpStatusChange} />
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
