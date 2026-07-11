import { useMemo, type JSX } from 'react';
import type { Variable } from '#/shared/types';
import type { ConsoleEntry } from '#/renderer/src/store';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActivePluginFooterPanelId,
  togglePluginFooterPanel
} from '#/renderer/src/store/slices/navigationSlice';
import { usePluginFooterPanels } from '#/renderer/src/plugins/pluginHooks';
import { ConsolePanel } from './ConsolePanel';
import { McpPanel } from './McpPanel';
import { PluginFooterPanel } from './PluginFooterPanel';
import { VariablesPanel } from './VariablesPanel';
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
  onMcpStatusChange
}: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const pluginFooterPanels = usePluginFooterPanels();
  const activePluginFooterPanelId = useAppSelector(selectActivePluginFooterPanelId);

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

  return (
    <div className="absolute inset-x-0 bottom-0">
      <ConsolePanel
        entries={entries}
        open={consoleOpen}
        onClose={onToggleConsole}
        onClear={onClear}
      />
      <VariablesPanel
        variables={resolvedVariables}
        open={variablesOpen}
        onClose={onToggleVariables}
        collectionName={collectionName}
        folderName={folderName}
        environmentName={environmentName}
      />
      <McpPanel open={mcpOpen} onClose={onToggleMcp} onStatusChange={onMcpStatusChange} />
      {pluginFooterPanels.map((panel) => (
        <PluginFooterPanel
          key={panel.id}
          id={panel.id}
          pluginId={panel.pluginId}
          contributionId={panel.contributionId}
          title={panel.title}
          open={activePluginFooterPanelId === panel.id}
          onClose={() => dispatch(togglePluginFooterPanel(panel.id))}
        />
      ))}
    </div>
  );
}
