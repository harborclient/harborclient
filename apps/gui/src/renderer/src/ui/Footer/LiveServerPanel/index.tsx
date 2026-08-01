import { useCallback, useMemo, type JSX } from 'react';
import toast from 'react-hot-toast';
import {
  Button,
  FaIcon,
  FooterPanel,
  SegmentedTabPanel,
  SegmentedTabs,
  SegmentedTabsGroup,
  StatusDot
} from '@harborclient/sdk/components';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectRunningLiveServers } from '#/renderer/src/store/selectors';
import {
  closeLiveServerModal,
  selectLiveServerModal,
  setLiveServerModalAliases,
  setLiveServerModalBusy,
  setLiveServerModalCors,
  setLiveServerModalHeaders,
  setLiveServerModalHost,
  setLiveServerModalIndexFiles,
  setLiveServerModalName,
  setLiveServerModalUrlVariable,
  setLiveServerModalOpenPath,
  setLiveServerModalPort,
  setLiveServerModalPostRequestScripts,
  setLiveServerModalPreRequestScripts,
  setLiveServerModalProxies,
  setLiveServerModalRememberLastUrl,
  setLiveServerModalRoot,
  setLiveServerModalRoutes,
  setLiveServerModalRunCommand,
  setLiveServerModalRestartOnCrash,
  setLiveServerModalSsl,
  setLiveServerModalSubmitError,
  setLiveServerModalTab,
  setLiveServerModalWatch,
  type LiveServerModalState,
  type LiveServerModalTab
} from '#/renderer/src/store/slices/modalsSlice';
import type { LiveServerConfig } from '@harborclient/core/types';
import { isValidLiveServerProxyTarget } from '@harborclient/core/types';
import {
  createSavedLiveServer,
  liveServerRuntimeConfigNeedsRestart,
  restartLiveServer,
  startLiveServer,
  stopLiveServer,
  toLiveServerConfig,
  updateSavedLiveServer
} from '#/renderer/src/store/thunks/liveServers';
import { selectSnippets } from '#/renderer/src/store/selectors';
import { faCircleExclamation } from '#/renderer/src/fontawesome';
import { formatErrorMessage } from '#/renderer/src/ui/Modals/dialogHelpers';
import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/useSidebarExpansion';
import { AliasSettings } from './AliasSettings';
import { CorsSettings } from './CorsSettings';
import { GeneralSettings } from './GeneralSettings';
import { HeadersSettings } from './HeadersSettings';
import { filterLiveServerHeadersForSave } from './liveServerHeaderRows';
import { ProxySettings } from './ProxySettings';
import { RoutingSettings } from './RoutingSettings';
import { LiveServerScriptsSettings } from './Scripts';
import { SslSettings } from './SslSettings';

interface Props {
  /**
   * Whether the panel is visible (slides up when true).
   */
  open: boolean;

  /**
   * Closes the live server editor panel.
   */
  onClose: () => void;
}

/**
 * Parses the port field; blank means auto-select (`null`).
 *
 * @param value - Raw port input.
 * @returns Port number, null for auto, or an error message.
 */
function parsePortField(value: string): { port: number | null } | { error: string } {
  const trimmed = value.trim();
  if (trimmed === '') {
    return { port: null };
  }
  const port = Number(trimmed);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { error: 'Port must be an integer between 1 and 65535' };
  }
  return { port };
}

/**
 * Pure validation + normalize of the live server editor draft.
 *
 * Does not dispatch — safe to call during render for restart detection.
 *
 * @param modal - Footer panel draft state.
 * @returns Normalized config, or an inline validation error message.
 */
function tryBuildConfigFromModal(
  modal: LiveServerModalState
): { config: LiveServerConfig } | { error: string } {
  const name = modal.name.trim() || 'Live Server';
  const root = modal.root.trim();
  if (!root) {
    return { error: 'Choose a root directory' };
  }
  const parsed = parsePortField(modal.port);
  if ('error' in parsed) {
    return { error: parsed.error };
  }
  const aliases = modal.aliases
    .map((alias) => ({
      path: alias.path.trim(),
      target: alias.target.trim()
    }))
    .filter((alias) => alias.path !== '' && alias.target !== '');
  for (const alias of aliases) {
    if (!alias.path.startsWith('/')) {
      return { error: 'Alias paths must start with /' };
    }
  }
  const proxies = modal.proxies
    .map((proxy) => {
      const trimmedPath = proxy.path.trim();
      return {
        path: trimmedPath === '*' ? '/' : trimmedPath,
        target: proxy.target.trim(),
        stripPath: proxy.stripPath !== false,
        enabled: proxy.enabled !== false
      };
    })
    .filter((proxy) => proxy.path !== '' || proxy.target !== '');
  for (const proxy of proxies) {
    if (proxy.path === '' || proxy.target === '') {
      return { error: 'Proxy rules need both a path and a target URL' };
    }
    if (proxy.path !== '/' && !proxy.path.startsWith('/')) {
      return { error: 'Proxy paths must start with / (or use * for catch-all)' };
    }
    if (!isValidLiveServerProxyTarget(proxy.target)) {
      return { error: 'Proxy targets must be absolute http:// or https:// URLs' };
    }
  }
  if (modal.ssl.enabled) {
    if (!modal.ssl.certPath.trim()) {
      return { error: 'Certificate path is required when SSL is enabled' };
    }
    if (!modal.ssl.keyPath.trim()) {
      return { error: 'Private key path is required when SSL is enabled' };
    }
  }
  return {
    config: toLiveServerConfig({
      name,
      root,
      port: parsed.port,
      aliases,
      watch: modal.watch,
      cors: modal.cors,
      openPath: modal.openPath,
      rememberLastUrl: modal.rememberLastUrl,
      lastOpenedPath: modal.lastOpenedPath,
      indexFiles: modal.indexFiles,
      host: modal.host,
      headers: filterLiveServerHeadersForSave(modal.headers),
      routes: modal.routes,
      proxies,
      ssl: modal.ssl,
      runCommand: modal.runCommand,
      restartOnCrash: modal.restartOnCrash,
      urlVariable: modal.urlVariable,
      preRequestScripts: modal.preRequestScripts,
      postRequestScripts: modal.postRequestScripts
    })
  };
}

/**
 * Slide-up footer panel for configuring, saving, and starting a live server.
 */
export function LiveServerPanel({ open, onClose }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const modal = useAppSelector(selectLiveServerModal);
  const runningServers = useAppSelector(selectRunningLiveServers);
  const snippets = useAppSelector(selectSnippets);
  const globalVariables = useAppSelector((state) => state.settings.general.globalVariables);
  const { setActiveSidebarMode } = useSidebarExpansion();

  /**
   * Running instance for the server being edited, when one is bound to its saved id.
   */
  const runningInstance = useMemo(() => {
    if (modal?.savedId == null) {
      return null;
    }
    return runningServers.find((server) => server.savedId === modal.savedId) ?? null;
  }, [modal, runningServers]);

  /**
   * Closes the panel when not busy.
   */
  const handleClose = useCallback((): void => {
    if (modal?.busy) {
      return;
    }
    onClose();
  }, [modal?.busy, onClose]);

  /**
   * Opens the native directory picker and updates the root field.
   */
  const handleBrowse = useCallback((): void => {
    if (!modal) {
      return;
    }
    void window.api.selectDirectory(modal.root).then((selected) => {
      if (selected != null) {
        dispatch(setLiveServerModalRoot(selected));
        if (!modal.name.trim()) {
          const base = selected.split(/[/\\]/).filter(Boolean).pop();
          if (base) {
            dispatch(setLiveServerModalName(base));
          }
        }
      }
    });
  }, [dispatch, modal]);

  /**
   * Builds a normalized config from the editor fields, or sets an inline error.
   *
   * When SSL is enabled, cert and key paths must be non-empty (file existence is
   * validated in the main process on start).
   *
   * @returns Config when valid, otherwise null.
   */
  const buildConfig = useCallback((): LiveServerConfig | null => {
    if (!modal) {
      return null;
    }
    const result = tryBuildConfigFromModal(modal);
    if ('error' in result) {
      dispatch(setLiveServerModalSubmitError(result.error));
      return null;
    }
    return result.config;
  }, [dispatch, modal]);

  /**
   * True when the editor draft’s runtime fields differ from the running snapshot.
   *
   * Used for the restart-required banner. Uses a pure draft build so this memo
   * never dispatches during render. Rebuilds when the modal draft or running
   * instance changes.
   */
  const needsRestart = useMemo(() => {
    if (runningInstance == null || modal == null) {
      return false;
    }
    const result = tryBuildConfigFromModal(modal);
    if ('error' in result) {
      return false;
    }
    return liveServerRuntimeConfigNeedsRestart(result.config, runningInstance.config);
  }, [modal, runningInstance]);

  /**
   * Saves the config without starting the server.
   *
   * When an instance is already running, keeps the panel open so the
   * restart-required banner remains visible after persisting runtime changes.
   */
  const handleSave = useCallback(async (): Promise<void> => {
    if (!modal) {
      return;
    }
    const config = buildConfig();
    if (!config) {
      return;
    }
    const keepOpen = runningInstance != null;
    const restartNeeded =
      runningInstance != null &&
      liveServerRuntimeConfigNeedsRestart(config, runningInstance.config);
    dispatch(setLiveServerModalSubmitError(null));
    dispatch(setLiveServerModalBusy(true));
    try {
      if (modal.mode === 'edit' && modal.savedId != null) {
        await dispatch(
          updateSavedLiveServer({
            id: modal.savedId,
            ...config
          })
        ).unwrap();
      } else {
        await dispatch(
          createSavedLiveServer({
            ...config
          })
        ).unwrap();
      }
      toast.success(restartNeeded ? 'Saved — restart to apply' : 'Live server saved');
      if (!keepOpen) {
        dispatch(closeLiveServerModal());
        setActiveSidebarMode('servers');
      }
    } catch (error) {
      dispatch(
        setLiveServerModalSubmitError(formatErrorMessage(error, 'Failed to save live server'))
      );
    } finally {
      dispatch(setLiveServerModalBusy(false));
    }
  }, [buildConfig, dispatch, modal, runningInstance, setActiveSidebarMode]);

  /**
   * Persists the config when needed, starts the server, and opens a browser tab.
   *
   * Create mode always saves first so every running server has a registry row.
   */
  const handleStart = useCallback(async (): Promise<void> => {
    if (!modal) {
      return;
    }
    const config = buildConfig();
    if (!config) {
      return;
    }
    dispatch(setLiveServerModalSubmitError(null));
    dispatch(setLiveServerModalBusy(true));
    try {
      let savedId = modal.savedId;
      if (modal.mode === 'edit' && savedId != null) {
        await dispatch(
          updateSavedLiveServer({
            id: savedId,
            ...config
          })
        ).unwrap();
      } else {
        const created = await dispatch(
          createSavedLiveServer({
            ...config
          })
        ).unwrap();
        savedId = created.id;
      }

      await dispatch(
        startLiveServer({
          savedId,
          config
        })
      ).unwrap();
      toast.success('Live server started');
      dispatch(closeLiveServerModal());
      setActiveSidebarMode('servers');
    } catch (error) {
      dispatch(
        setLiveServerModalSubmitError(formatErrorMessage(error, 'Failed to start live server'))
      );
    } finally {
      dispatch(setLiveServerModalBusy(false));
    }
  }, [buildConfig, dispatch, modal, setActiveSidebarMode]);

  /**
   * Persists the editor draft, then stops and starts the running instance so
   * Express middleware (routes, headers, CORS, …) picks up the new snapshot.
   *
   * Keeps the panel open so the user can continue editing after the banner clears.
   */
  const handleRestart = useCallback(async (): Promise<void> => {
    if (!modal || runningInstance == null) {
      return;
    }
    const config = buildConfig();
    if (!config) {
      return;
    }
    dispatch(setLiveServerModalSubmitError(null));
    dispatch(setLiveServerModalBusy(true));
    try {
      let savedId = modal.savedId;
      if (modal.mode === 'edit' && savedId != null) {
        await dispatch(
          updateSavedLiveServer({
            id: savedId,
            ...config
          })
        ).unwrap();
      } else {
        const created = await dispatch(
          createSavedLiveServer({
            ...config
          })
        ).unwrap();
        savedId = created.id;
      }

      await dispatch(
        restartLiveServer({
          runtimeId: runningInstance.id,
          savedId,
          config
        })
      ).unwrap();
      toast.success('Live server restarted');
    } catch (error) {
      dispatch(
        setLiveServerModalSubmitError(formatErrorMessage(error, 'Failed to restart live server'))
      );
    } finally {
      dispatch(setLiveServerModalBusy(false));
    }
  }, [buildConfig, dispatch, modal, runningInstance]);

  /**
   * Stops the running instance for the server being edited.
   */
  const handleStop = useCallback(async (): Promise<void> => {
    if (runningInstance == null) {
      return;
    }
    dispatch(setLiveServerModalSubmitError(null));
    dispatch(setLiveServerModalBusy(true));
    try {
      await dispatch(stopLiveServer(runningInstance.id)).unwrap();
      toast.success('Live server stopped');
    } catch (error) {
      dispatch(
        setLiveServerModalSubmitError(formatErrorMessage(error, 'Failed to stop live server'))
      );
    } finally {
      dispatch(setLiveServerModalBusy(false));
    }
  }, [dispatch, runningInstance]);

  const busy = modal?.busy ?? false;
  const tab: LiveServerModalTab = modal?.tab ?? 'general';
  const isRunning = runningInstance != null;
  const statusLabel = isRunning ? 'Running' : 'Stopped';

  /**
   * Panel heading with a green/red status dot matching the sidebar live-server rows.
   */
  const title = (
    <>
      <span>{modal?.mode === 'edit' ? 'Edit Live Server' : 'New Live Server'}</span>
      <StatusDot
        variant={isRunning ? 'success' : 'danger'}
        size="sm"
        label={statusLabel}
        title={statusLabel}
      />
    </>
  );

  /**
   * Header actions rendered beside the close button when the editor is open.
   */
  const headerButtons = modal
    ? [
        <Button
          key="save"
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => void handleSave()}
        >
          Save
        </Button>,
        ...(isRunning
          ? [
              <Button
                key="restart"
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void handleRestart()}
              >
                Restart
              </Button>,
              <Button
                key="stop"
                type="button"
                variant="primaryDanger"
                disabled={busy}
                onClick={() => void handleStop()}
              >
                Stop
              </Button>
            ]
          : [
              <Button
                key="start"
                type="button"
                disabled={busy || !modal.root.trim()}
                onClick={() => void handleStart()}
              >
                Start
              </Button>
            ])
      ]
    : undefined;

  return (
    <FooterPanel
      id="footer-live-server-panel"
      open={open}
      onClose={handleClose}
      closeLabel="Live server"
      storageKey="hc.liveServerPanelHeight"
      title={title}
      description="Serve a local folder over HTTP(S) and open it in a Live Page."
      buttons={headerButtons}
      unmountWhenClosed
    >
      {modal ? (
        <div className="flex h-full min-h-0 flex-col">
          <SegmentedTabsGroup
            value={tab}
            onChange={(next) => dispatch(setLiveServerModalTab(next))}
            ariaLabel="Live server settings"
          >
            <div className="shrink-0">
              <SegmentedTabs
                fullWidth
                tabs={[
                  { value: 'general', label: 'General' },
                  { value: 'headers', label: 'Headers' },
                  { value: 'routing', label: 'Routing' },
                  { value: 'proxy', label: 'Proxy' },
                  { value: 'aliases', label: 'Aliases' },
                  { value: 'cors', label: 'CORS' },
                  { value: 'ssl', label: 'SSL' },
                  { value: 'scripts', label: 'Scripts' }
                ]}
              />
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4">
              {modal.submitError ? (
                <p className="m-0 mb-4 text-danger" role="alert">
                  {modal.submitError}
                </p>
              ) : null}

              {isRunning && needsRestart ? (
                <p
                  className="m-0 mb-4 flex items-start gap-2 text-[14px] text-warning"
                  role="status"
                  aria-live="polite"
                >
                  <FaIcon icon={faCircleExclamation} className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    These changes require a restart to take effect. Use Restart to apply them to the
                    running server.
                  </span>
                </p>
              ) : null}

              <SegmentedTabPanel value="general">
                <GeneralSettings
                  name={modal.name}
                  variables={globalVariables}
                  urlVariable={modal.urlVariable}
                  root={modal.root}
                  port={modal.port}
                  watch={modal.watch}
                  openPath={modal.openPath}
                  rememberLastUrl={modal.rememberLastUrl}
                  indexFiles={modal.indexFiles}
                  host={modal.host}
                  runCommand={modal.runCommand}
                  restartOnCrash={modal.restartOnCrash}
                  disabled={busy}
                  onNameChange={(value) => dispatch(setLiveServerModalName(value))}
                  onUrlVariableChange={(value) => dispatch(setLiveServerModalUrlVariable(value))}
                  onRootChange={(value) => dispatch(setLiveServerModalRoot(value))}
                  onBrowse={handleBrowse}
                  onPortChange={(value) => dispatch(setLiveServerModalPort(value))}
                  onWatchChange={(value) => dispatch(setLiveServerModalWatch(value))}
                  onOpenPathChange={(value) => dispatch(setLiveServerModalOpenPath(value))}
                  onRememberLastUrlChange={(value) =>
                    dispatch(setLiveServerModalRememberLastUrl(value))
                  }
                  onIndexFilesChange={(value) => dispatch(setLiveServerModalIndexFiles(value))}
                  onHostChange={(value) => dispatch(setLiveServerModalHost(value))}
                  onRunCommandChange={(value) => dispatch(setLiveServerModalRunCommand(value))}
                  onRestartOnCrashChange={(value) =>
                    dispatch(setLiveServerModalRestartOnCrash(value))
                  }
                />
              </SegmentedTabPanel>

              <SegmentedTabPanel value="headers">
                <HeadersSettings
                  headers={modal.headers}
                  disabled={busy}
                  onChange={(next) => dispatch(setLiveServerModalHeaders(next))}
                />
              </SegmentedTabPanel>

              <SegmentedTabPanel value="routing">
                <RoutingSettings
                  routes={modal.routes}
                  disabled={busy}
                  onChange={(next) => dispatch(setLiveServerModalRoutes(next))}
                />
              </SegmentedTabPanel>

              <SegmentedTabPanel value="proxy">
                <ProxySettings
                  proxies={modal.proxies}
                  disabled={busy}
                  onChange={(next) => dispatch(setLiveServerModalProxies(next))}
                />
              </SegmentedTabPanel>

              <SegmentedTabPanel value="aliases">
                <AliasSettings
                  aliases={modal.aliases}
                  disabled={busy}
                  onChange={(next) => dispatch(setLiveServerModalAliases(next))}
                />
              </SegmentedTabPanel>

              <SegmentedTabPanel value="cors">
                <CorsSettings
                  cors={modal.cors}
                  disabled={busy}
                  onChange={(next) => dispatch(setLiveServerModalCors(next))}
                />
              </SegmentedTabPanel>

              <SegmentedTabPanel value="ssl">
                <SslSettings
                  ssl={modal.ssl}
                  disabled={busy}
                  onChange={(next) => dispatch(setLiveServerModalSsl(next))}
                />
              </SegmentedTabPanel>

              <SegmentedTabPanel value="scripts">
                <LiveServerScriptsSettings
                  preRequestScripts={modal.preRequestScripts}
                  postRequestScripts={modal.postRequestScripts}
                  onPreRequestScriptsChange={(next) =>
                    dispatch(setLiveServerModalPreRequestScripts(next))
                  }
                  onPostRequestScriptsChange={(next) =>
                    dispatch(setLiveServerModalPostRequestScripts(next))
                  }
                  snippets={snippets}
                  variables={[]}
                />
              </SegmentedTabPanel>
            </div>
          </SegmentedTabsGroup>
        </div>
      ) : null}
    </FooterPanel>
  );
}
