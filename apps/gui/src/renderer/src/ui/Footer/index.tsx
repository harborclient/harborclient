import {
  FaIcon,
  FooterButton,
  FooterIcon,
  FOOTER_STATUS_BAR_SLOT_HEIGHT,
  footerBarPaddingClass,
  RowActionsMenu,
  StatusDot
} from '@harborclient/sdk/components';
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';

import {
  faBars,
  faInbox,
  faKeyboard,
  faPaperPlane,
  faCodeBranch,
  faLeaf,
  faTableColumns,
  faWandMagicSparkles
} from '#/renderer/src/fontawesome';
import { iconActionMenu, ACTION_MENU_ICON_CLASS } from '#/renderer/src/icons/customIcons';
import { useMcpServerStatus } from '#/renderer/src/hooks/useMcpServerStatus';
import { actionMenuToggleClass, footerButtonGroup } from '#/renderer/src/ui/Shared/classes';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActiveEnvironmentId,
  selectBrowserTabWithSettingsOpen,
  selectConsoleEntries,
  selectEnvironments
} from '#/renderer/src/store/selectors';
import { setActiveEnvironmentId } from '#/renderer/src/store/slices/environmentsSlice';
import {
  selectActivePluginFooterPanelId,
  selectAiSidebarVisible,
  selectGitSidebarVisible,
  selectShortcutsSidebarVisible,
  selectShowConsole,
  selectShowMcp,
  selectShowRail,
  selectShowRequestEditor,
  selectShowResponseEditor,
  selectShowTerminal,
  selectShowVariables,
  selectSidebarVisible,
  toggleAiSidebar,
  toggleConsole,
  toggleGitSidebar,
  toggleMcp,
  togglePluginFooterPanel,
  toggleRail,
  toggleRequestEditor,
  toggleResponseEditor,
  toggleShortcutsSidebar,
  toggleSidebar,
  toggleTerminal,
  toggleVariables
} from '#/renderer/src/store/slices/navigationSlice';
import {
  closeActionMenuModal,
  closeLiveServerModal,
  openActionMenuModal,
  selectActionMenuModal
} from '#/renderer/src/store/slices/modalsSlice';
import { setBrowserSettingsPanelOpen } from '#/renderer/src/store/slices/tabsSlice';
import { HostedSurface } from '#/renderer/src/plugins/HostedSurface';
import {
  usePluginFooterPanelIndicators,
  usePluginFooterPanels,
  usePluginStatusBarItems
} from '#/renderer/src/plugins/pluginHooks';
import { handleFooterBarTabNavigation } from './footerBarTabNavigation';
import { APP_FOOTER_SECTION_ID } from '#/renderer/src/ui/Shared/SkipNavigation/skipNavigationTargets';
import { useActiveScopedVariables } from './useActiveScopedVariables';
import { effectiveCount, resolveScopedVariables } from './VariablesPanel/resolve';

/** Stable menu id for the footer environment picker. */
const FOOTER_ENVIRONMENT_MENU_ID = 'footer-environment-menu';

/**
 * Stable style for status-bar HostedSurface slots.
 * Must stay module-level so Footer re-renders do not remount the webview.
 */
const STATUS_BAR_SURFACE_STYLE = {
  minHeight: FOOTER_STATUS_BAR_SLOT_HEIGHT,
  height: FOOTER_STATUS_BAR_SLOT_HEIGHT,
  width: 120
} as const;

/**
 * Stable container style for status-bar HostedSurface wrappers.
 */
const STATUS_BAR_SLOT_STYLE = {
  width: 120,
  height: FOOTER_STATUS_BAR_SLOT_HEIGHT
} as const;

/**
 * Persistent window footer bar with toggles for slide-up panels and layout controls.
 */
export function Footer(): JSX.Element {
  const dispatch = useAppDispatch();
  const pluginFooterPanels = usePluginFooterPanels();
  const pluginFooterPanelIndicators = usePluginFooterPanelIndicators();
  const statusBarItems = usePluginStatusBarItems();
  const mcpServerStatus = useMcpServerStatus();
  const { globalVariables, collectionVariables, folderVariables, environmentVariables } =
    useActiveScopedVariables();

  const consoleOpen = useAppSelector(selectShowConsole);
  const entryCount = useAppSelector(selectConsoleEntries).length;
  const variablesOpen = useAppSelector(selectShowVariables);
  const showMcp = useAppSelector(selectShowMcp);
  const terminalOpen = useAppSelector(selectShowTerminal);
  const sidebarOpen = useAppSelector(selectSidebarVisible);
  const railOpen = useAppSelector(selectShowRail);
  const aiSidebarOpen = useAppSelector(selectAiSidebarVisible);
  const gitSidebarOpen = useAppSelector(selectGitSidebarVisible);
  const shortcutsSidebarOpen = useAppSelector(selectShortcutsSidebarVisible);
  const requestEditorOpen = useAppSelector(selectShowRequestEditor);
  const responseEditorOpen = useAppSelector(selectShowResponseEditor);
  const settingsBrowserTab = useAppSelector(selectBrowserTabWithSettingsOpen);
  const activePluginFooterPanelId = useAppSelector(selectActivePluginFooterPanelId);
  const actionMenuOpen = useAppSelector(selectActionMenuModal)?.open === true;
  const environments = useAppSelector(selectEnvironments);
  const activeEnvironmentId = useAppSelector(selectActiveEnvironmentId);

  const mcpServerEnabled = mcpServerStatus.enabled;
  const mcpServerRunning = mcpServerStatus.running;
  const mcpOpen = showMcp && mcpServerEnabled;

  const [envMenuOpen, setEnvMenuOpen] = useState<string | null>(null);
  const footerRef = useRef<HTMLElement>(null);
  const leftGroupRef = useRef<HTMLDivElement>(null);
  const rightIconsRef = useRef<HTMLDivElement>(null);

  /**
   * Closes the live page settings footer panel when open, even if that browser tab is not active.
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
    dispatch(closeLiveServerModal());
    closeLivePageSettings();
    dispatch(toggleConsole());
  }, [closeLivePageSettings, dispatch]);

  /**
   * Closes exclusive editors, then toggles the variables panel.
   */
  const handleToggleVariables = useCallback((): void => {
    dispatch(closeLiveServerModal());
    closeLivePageSettings();
    dispatch(toggleVariables());
  }, [closeLivePageSettings, dispatch]);

  /**
   * Closes exclusive editors, then toggles the MCP panel.
   */
  const handleToggleMcp = useCallback((): void => {
    dispatch(closeLiveServerModal());
    closeLivePageSettings();
    dispatch(toggleMcp());
  }, [closeLivePageSettings, dispatch]);

  /**
   * Closes exclusive editors, then toggles the terminal panel.
   */
  const handleToggleTerminal = useCallback((): void => {
    dispatch(closeLiveServerModal());
    closeLivePageSettings();
    dispatch(toggleTerminal());
  }, [closeLivePageSettings, dispatch]);

  /**
   * Attaches a native capture-phase Tab handler so focus wraps from the last
   * left panel toggle to the right layout icons before the browser applies its
   * default Tab navigation. A native listener avoids relying on React's
   * synthetic capture ordering, which is delegated at the root container.
   */
  useEffect(() => {
    const footer = footerRef.current;
    if (footer == null) {
      return;
    }

    /**
     * Runs the footer Tab handoff against the current left and right groups.
     *
     * @param event - Native keydown event from within the footer bar.
     */
    const handleKeyDown = (event: KeyboardEvent): void => {
      const leftGroup = leftGroupRef.current;
      const rightIcons = rightIconsRef.current;
      if (leftGroup == null || rightIcons == null) {
        return;
      }

      handleFooterBarTabNavigation(event, leftGroup, rightIcons);
    };

    footer.addEventListener('keydown', handleKeyDown, true);
    return () => footer.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  /**
   * Merges scoped variables for the footer variables badge count.
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
  const variableCount = effectiveCount(resolvedVariables);

  /**
   * Resolves the active environment display name for the footer status line.
   */
  const activeEnvironmentName = useMemo(() => {
    if (activeEnvironmentId == null) {
      return null;
    }
    return environments.find((env) => env.id === activeEnvironmentId)?.name ?? null;
  }, [activeEnvironmentId, environments]);

  /**
   * Environment picker menu groups with a checkmark on the active environment.
   */
  const environmentMenuGroups = useMemo(
    () => [
      environments.map((environment) => ({
        label: environment.name,
        checked: environment.id === activeEnvironmentId,
        onSelect: () =>
          dispatch(
            setActiveEnvironmentId(environment.id === activeEnvironmentId ? null : environment.id)
          )
      }))
    ],
    [activeEnvironmentId, dispatch, environments]
  );

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
    <footer
      id={APP_FOOTER_SECTION_ID}
      tabIndex={-1}
      ref={footerRef}
      className="relative z-50 flex shrink-0 items-stretch border-t border-separator bg-footer app-no-drag"
    >
      <button
        type="button"
        onClick={() => dispatch(actionMenuOpen ? closeActionMenuModal() : openActionMenuModal())}
        aria-pressed={actionMenuOpen}
        aria-label={actionMenuOpen ? 'Hide Action menu' : 'Show Action menu'}
        title="Action menu"
        className={actionMenuToggleClass(actionMenuOpen)}
      >
        <FaIcon icon={iconActionMenu} className={ACTION_MENU_ICON_CLASS} />
      </button>
      <div className={`flex min-w-0 flex-1 items-center justify-between ${footerBarPaddingClass}`}>
        <div className={`${footerButtonGroup} min-w-0 flex-1`}>
          {leftStatusItems.map((item) => (
            <div
              key={item.id}
              className="overflow-hidden px-1"
              style={{ width: 120, height: FOOTER_STATUS_BAR_SLOT_HEIGHT }}
            >
              <HostedSurface
                pluginId={item.pluginId}
                contributionId={item.contributionId}
                kind="statusBarItems"
                resizeMode="fill"
                style={{
                  minHeight: FOOTER_STATUS_BAR_SLOT_HEIGHT,
                  height: FOOTER_STATUS_BAR_SLOT_HEIGHT,
                  width: 120
                }}
              />
            </div>
          ))}
          <div ref={leftGroupRef} className="inline-flex min-w-0 items-center ps-2">
            <RowActionsMenu
              menuId={FOOTER_ENVIRONMENT_MENU_ID}
              openMenuId={envMenuOpen}
              onOpenChange={setEnvMenuOpen}
              placement="up"
              triggerVariant="toolbar"
              triggerIcon={faLeaf}
              triggerLabel={activeEnvironmentName ?? 'Environment'}
              triggerTitle={activeEnvironmentName ?? 'Environment'}
              triggerAriaLabel="Select environment"
              triggerClassName="hc-footer-button w-[10rem] min-w-[10rem] justify-start gap-1 overflow-hidden rounded-md border-none bg-transparent px-2 py-0.5 text-left text-footer-muted hover:bg-transparent hover:text-footer-text"
              groups={environmentMenuGroups}
            />
            <FooterButton
              active={variablesOpen}
              onClick={handleToggleVariables}
              controlsId="footer-variables-panel"
            >
              Variables
              {variableCount > 0 && (
                <span className="ml-1 text-[14px] text-muted">({variableCount})</span>
              )}
            </FooterButton>
            {mcpServerEnabled ? (
              <FooterButton
                active={mcpOpen}
                onClick={handleToggleMcp}
                controlsId="footer-mcp-panel"
                aria-label={mcpServerRunning ? 'MCP, server running' : 'MCP, server stopped'}
              >
                <span className="inline-flex items-center">
                  MCP
                  <span className="ml-1 inline-flex h-4 w-3 shrink-0 items-center justify-center">
                    <StatusDot variant={mcpServerRunning ? 'success' : 'muted'} size="sm" />
                  </span>
                </span>
              </FooterButton>
            ) : null}
            <FooterButton
              active={terminalOpen}
              onClick={handleToggleTerminal}
              controlsId="footer-terminal-panel"
            >
              <span className="inline-flex items-center gap-1">Terminal</span>
            </FooterButton>
            <FooterButton
              active={consoleOpen}
              onClick={handleToggleConsole}
              controlsId="footer-console-panel"
            >
              Console
              {entryCount > 0 && (
                <span className="ml-1 text-[14px] text-muted">({entryCount})</span>
              )}
            </FooterButton>

            {pluginFooterPanels.map((panel) => {
              const indicator = pluginFooterPanelIndicators[panel.id];
              return (
                <FooterButton
                  key={panel.id}
                  active={activePluginFooterPanelId === panel.id}
                  onClick={() => dispatch(togglePluginFooterPanel(panel.id))}
                  controlsId={`footer-plugin-panel-${panel.id}`}
                >
                  <span className="inline-flex items-center">
                    {panel.title}
                    {indicator != null ? (
                      <span className="ml-1 inline-flex h-4 w-3 shrink-0 items-center justify-center">
                        <StatusDot variant={indicator.status} size="sm" label={indicator.label} />
                      </span>
                    ) : null}
                  </span>
                </FooterButton>
              );
            })}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 pr-2">
          {rightStatusItems.map((item) => (
            <div key={item.id} className="overflow-hidden px-1" style={STATUS_BAR_SLOT_STYLE}>
              <HostedSurface
                pluginId={item.pluginId}
                contributionId={item.contributionId}
                kind="statusBarItems"
                resizeMode="fill"
                style={STATUS_BAR_SURFACE_STYLE}
              />
            </div>
          ))}
          <div ref={rightIconsRef} className="flex items-center gap-2">
            <FooterIcon
              onClick={() => dispatch(toggleRequestEditor())}
              icon={faPaperPlane}
              active={requestEditorOpen}
              activeStyle="selection"
              label="request editor"
            />
            <FooterIcon
              onClick={() => dispatch(toggleResponseEditor())}
              icon={faInbox}
              active={responseEditorOpen}
              activeStyle="selection"
              label="response editor"
            />
            <FooterIcon
              onClick={() => dispatch(toggleRail())}
              icon={faBars}
              active={railOpen}
              activeStyle="selection"
              label="rail"
            />
            <FooterIcon
              onClick={() => dispatch(toggleSidebar())}
              icon={faTableColumns}
              active={sidebarOpen}
              activeStyle="selection"
              label="sidebar"
            />
            <FooterIcon
              onClick={() => dispatch(toggleAiSidebar())}
              icon={faWandMagicSparkles}
              active={aiSidebarOpen}
              activeStyle="selection"
              label="agent chat"
            />
            <FooterIcon
              onClick={() => dispatch(toggleGitSidebar())}
              icon={faCodeBranch}
              active={gitSidebarOpen}
              activeStyle="selection"
              label="git source control"
            />
            <FooterIcon
              onClick={() => dispatch(toggleShortcutsSidebar())}
              icon={faKeyboard}
              active={shortcutsSidebarOpen}
              activeStyle="selection"
              label="shortcuts"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
