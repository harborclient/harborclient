import { FooterButton, FooterIcon, segmentGroup } from '@harborclient/sdk/components';
import { useMemo, type JSX } from 'react';
import type { Variable } from '#/shared/types';
import type { ConsoleEntry } from '#/renderer/src/store';

import { faInbox, faPaperPlane, faRobot, faTableColumns } from '#/renderer/src/fontawesome';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActivePluginFooterPanelId,
  togglePluginFooterPanel
} from '#/renderer/src/store/slices/navigationSlice';
import { PluginSurface } from '#/renderer/src/plugins/PluginSurface';
import { usePluginFooterPanels, usePluginStatusBarItems } from '#/renderer/src/plugins/pluginHooks';

import { ConsolePanel } from './ConsolePanel';
import { PluginFooterPanel } from './PluginFooterPanel';
import { VariablesPanel } from './VariablesPanel';
import { effectiveCount, resolveScopedVariables } from './VariablesPanel/resolve';

interface Props {
  /**
   * Whether the console panel is currently open.
   */
  consoleOpen: boolean;

  /**
   * Number of entries in the console log.
   */
  entryCount: number;

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
   * Variables from the active environment.
   */
  environmentVariables: Variable[];

  /**
   * Name of the active collection, if any.
   */
  collectionName?: string;

  /**
   * Name of the active environment, if any.
   */
  environmentName?: string;

  /**
   * Whether the sidebar is currently visible.
   */
  sidebarOpen: boolean;

  /**
   * Toggles the sidebar visible/hidden.
   */
  onToggleSidebar: () => void;

  /**
   * Whether the AI sidebar is currently visible.
   */
  aiSidebarOpen: boolean;

  /**
   * Toggles the AI sidebar visible/hidden.
   */
  onToggleAiSidebar: () => void;

  /**
   * Whether the request editor is currently visible.
   */
  requestEditorOpen: boolean;

  /**
   * Toggles the request editor visible/hidden.
   */
  onToggleRequestEditor: () => void;

  /**
   * Whether the response editor is currently visible.
   */
  responseEditorOpen: boolean;

  /**
   * Toggles the response editor visible/hidden.
   */
  onToggleResponseEditor: () => void;
}

/**
 * Persistent window footer with Console and Variables slide-up panels.
 */
export function Footer({
  consoleOpen,
  entryCount,
  entries,
  onToggleConsole,
  onClear,
  variablesOpen,
  onToggleVariables,
  globalVariables,
  collectionVariables,
  environmentVariables,
  collectionName,
  environmentName,
  sidebarOpen,
  onToggleSidebar,
  aiSidebarOpen,
  onToggleAiSidebar,
  requestEditorOpen,
  onToggleRequestEditor,
  responseEditorOpen,
  onToggleResponseEditor
}: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const pluginFooterPanels = usePluginFooterPanels();
  const statusBarItems = usePluginStatusBarItems();
  const activePluginFooterPanelId = useAppSelector(selectActivePluginFooterPanelId);

  /**
   * Merges collection and environment variables for the footer variables panel.
   */
  const resolvedVariables = useMemo(
    () => resolveScopedVariables(globalVariables, collectionVariables, environmentVariables),
    [globalVariables, collectionVariables, environmentVariables]
  );
  const variableCount = effectiveCount(resolvedVariables);

  /**
   * Status bar items grouped by alignment for stable footer layout.
   */
  const leftStatusItems = useMemo(
    () => statusBarItems.filter((item) => (item.alignment ?? 'right') === 'left'),
    [statusBarItems]
  );
  const rightStatusItems = useMemo(
    () => statusBarItems.filter((item) => (item.alignment ?? 'right') === 'right'),
    [statusBarItems]
  );

  return (
    <div className="relative shrink-0">
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
        environmentName={environmentName}
      />
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
      <footer className="relative z-50 flex shrink-0 items-center justify-between border-t border-separator bg-sidebar px-2 py-0.5 app-no-drag">
        <div className={`${segmentGroup} min-w-0 flex-1`}>
          {leftStatusItems.map((item) => (
            <div key={item.id} className="overflow-hidden px-1" style={{ width: 120, height: 20 }}>
              <PluginSurface
                pluginId={item.pluginId}
                contributionId={item.contributionId}
                kind="statusBarItems"
                resizeMode="fill"
                style={{ minHeight: 20, height: 20, width: 120 }}
              />
            </div>
          ))}
          <FooterButton
            active={consoleOpen}
            onClick={onToggleConsole}
            controlsId="footer-console-panel"
          >
            Console
            {entryCount > 0 && <span className="ml-1 text-[14px] text-muted">({entryCount})</span>}
          </FooterButton>
          <FooterButton
            active={variablesOpen}
            onClick={onToggleVariables}
            controlsId="footer-variables-panel"
          >
            Variables
            {variableCount > 0 && (
              <span className="ml-1 text-[14px] text-muted">({variableCount})</span>
            )}
          </FooterButton>
          {pluginFooterPanels.map((panel) => (
            <FooterButton
              key={panel.id}
              active={activePluginFooterPanelId === panel.id}
              onClick={() => dispatch(togglePluginFooterPanel(panel.id))}
              controlsId={`footer-plugin-panel-${panel.id}`}
            >
              {panel.title}
              {panel.hasIndicator ? (
                <span className="ml-1 inline-flex h-4 w-3 shrink-0 items-center overflow-hidden">
                  <PluginSurface
                    pluginId={panel.pluginId}
                    contributionId={panel.contributionId}
                    kind="footerPanels"
                    slot="indicator"
                    style={{ minHeight: 16, height: 16, width: 12 }}
                  />
                </span>
              ) : null}
            </FooterButton>
          ))}
        </div>
        <div className="flex items-center gap-0.5">
          {rightStatusItems.map((item) => (
            <div key={item.id} className="overflow-hidden px-1" style={{ width: 120, height: 20 }}>
              <PluginSurface
                pluginId={item.pluginId}
                contributionId={item.contributionId}
                kind="statusBarItems"
                resizeMode="fill"
                style={{ minHeight: 20, height: 20, width: 120 }}
              />
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <FooterIcon
              onClick={onToggleRequestEditor}
              icon={faPaperPlane}
              active={requestEditorOpen}
              label="request editor"
            />
            <FooterIcon
              onClick={onToggleResponseEditor}
              icon={faInbox}
              active={responseEditorOpen}
              label="response editor"
            />
            <FooterIcon
              onClick={onToggleSidebar}
              icon={faTableColumns}
              active={sidebarOpen}
              label="sidebar"
            />
            <FooterIcon
              onClick={onToggleAiSidebar}
              icon={faRobot}
              active={aiSidebarOpen}
              label="agent chat"
            />
          </div>
        </div>
      </footer>
    </div>
  );
}
