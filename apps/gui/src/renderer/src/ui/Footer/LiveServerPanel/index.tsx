import { useCallback, useMemo, type JSX } from 'react';
import toast from 'react-hot-toast';
import {
  Button,
  FooterPanel,
  SegmentedTabPanel,
  SegmentedTabs,
  SegmentedTabsGroup
} from '@harborclient/sdk/components';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectRunningLiveServers } from '#/renderer/src/store/selectors';
import {
  closeLiveServerModal,
  selectLiveServerModal,
  setLiveServerModalAliases,
  setLiveServerModalBusy,
  setLiveServerModalCors,
  setLiveServerModalName,
  setLiveServerModalPort,
  setLiveServerModalRoot,
  setLiveServerModalSubmitError,
  setLiveServerModalTab,
  setLiveServerModalWatch,
  type LiveServerModalTab
} from '#/renderer/src/store/slices/modalsSlice';
import {
  createSavedLiveServer,
  startLiveServer,
  stopLiveServer,
  toLiveServerConfig,
  updateSavedLiveServer
} from '#/renderer/src/store/thunks/liveServers';
import { formatErrorMessage } from '#/renderer/src/ui/Modals/dialogHelpers';
import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/useSidebarExpansion';
import { CorsSettings } from './CorsSettings';
import { GeneralSettings } from './GeneralSettings';

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
 * Slide-up footer panel for configuring, saving, and starting a live server.
 */
export function LiveServerPanel({ open, onClose }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const modal = useAppSelector(selectLiveServerModal);
  const runningServers = useAppSelector(selectRunningLiveServers);
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
   * @returns Config when valid, otherwise null.
   */
  const buildConfig = useCallback(() => {
    if (!modal) {
      return null;
    }
    const name = modal.name.trim() || 'Live Server';
    const root = modal.root.trim();
    if (!root) {
      dispatch(setLiveServerModalSubmitError('Choose a root directory'));
      return null;
    }
    const parsed = parsePortField(modal.port);
    if ('error' in parsed) {
      dispatch(setLiveServerModalSubmitError(parsed.error));
      return null;
    }
    const aliases = modal.aliases
      .map((alias) => ({
        path: alias.path.trim(),
        target: alias.target.trim()
      }))
      .filter((alias) => alias.path !== '' && alias.target !== '');
    for (const alias of aliases) {
      if (!alias.path.startsWith('/')) {
        dispatch(setLiveServerModalSubmitError('Alias paths must start with /'));
        return null;
      }
    }
    return toLiveServerConfig({
      name,
      root,
      port: parsed.port,
      aliases,
      watch: modal.watch,
      cors: modal.cors
    });
  }, [dispatch, modal]);

  /**
   * Saves the config without starting the server.
   */
  const handleSave = useCallback(async (): Promise<void> => {
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
      if (modal.mode === 'edit' && modal.savedId != null) {
        await dispatch(
          updateSavedLiveServer({
            id: modal.savedId,
            name: config.name,
            root: config.root,
            port: config.port,
            aliases: config.aliases,
            watch: config.watch,
            cors: config.cors
          })
        ).unwrap();
      } else {
        await dispatch(
          createSavedLiveServer({
            name: config.name,
            root: config.root,
            port: config.port,
            aliases: config.aliases,
            watch: config.watch,
            cors: config.cors
          })
        ).unwrap();
      }
      toast.success('Live server saved');
      dispatch(closeLiveServerModal());
      setActiveSidebarMode('servers');
    } catch (error) {
      dispatch(
        setLiveServerModalSubmitError(formatErrorMessage(error, 'Failed to save live server'))
      );
    } finally {
      dispatch(setLiveServerModalBusy(false));
    }
  }, [buildConfig, dispatch, modal, setActiveSidebarMode]);

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
            name: config.name,
            root: config.root,
            port: config.port,
            aliases: config.aliases,
            watch: config.watch,
            cors: config.cors
          })
        ).unwrap();
      } else {
        const created = await dispatch(
          createSavedLiveServer({
            name: config.name,
            root: config.root,
            port: config.port,
            aliases: config.aliases,
            watch: config.watch,
            cors: config.cors
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

  const title = modal?.mode === 'edit' ? 'Edit Live Server' : 'New Live Server';
  const busy = modal?.busy ?? false;
  const tab: LiveServerModalTab = modal?.tab ?? 'general';
  const isRunning = runningInstance != null;

  return (
    <FooterPanel
      id="footer-live-server-panel"
      open={open}
      onClose={handleClose}
      closeLabel="Live server"
      storageKey="hc.liveServerPanelHeight"
      title={title}
      description="Serve a local folder over HTTP and open it in a Live Page."
      unmountWhenClosed
    >
      {modal ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-auto p-4">
            {modal.submitError ? (
              <p className="m-0 mb-4 text-danger" role="alert">
                {modal.submitError}
              </p>
            ) : null}

            <SegmentedTabsGroup
              value={tab}
              onChange={(next) => dispatch(setLiveServerModalTab(next))}
              ariaLabel="Live server settings"
            >
              <div className="mb-4">
                <SegmentedTabs
                  fullWidth
                  editable={false}
                  tabs={[
                    { value: 'general', label: 'General' },
                    { value: 'cors', label: 'CORS' }
                  ]}
                />
              </div>

              <SegmentedTabPanel value="general">
                <GeneralSettings
                  name={modal.name}
                  root={modal.root}
                  port={modal.port}
                  aliases={modal.aliases}
                  watch={modal.watch}
                  disabled={busy}
                  onNameChange={(value) => dispatch(setLiveServerModalName(value))}
                  onRootChange={(value) => dispatch(setLiveServerModalRoot(value))}
                  onBrowse={handleBrowse}
                  onPortChange={(value) => dispatch(setLiveServerModalPort(value))}
                  onAliasesChange={(next) => dispatch(setLiveServerModalAliases(next))}
                  onWatchChange={(value) => dispatch(setLiveServerModalWatch(value))}
                />
              </SegmentedTabPanel>

              <SegmentedTabPanel value="cors">
                <CorsSettings
                  cors={modal.cors}
                  disabled={busy}
                  onChange={(next) => dispatch(setLiveServerModalCors(next))}
                />
              </SegmentedTabPanel>
            </SegmentedTabsGroup>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-separator px-4 py-3">
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void handleSave()}
            >
              Save
            </Button>
            {isRunning ? (
              <Button
                type="button"
                variant="primaryDanger"
                disabled={busy}
                onClick={() => void handleStop()}
              >
                Stop Server
              </Button>
            ) : (
              <Button
                type="button"
                disabled={busy || !modal.root.trim()}
                onClick={() => void handleStart()}
              >
                Start Server
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </FooterPanel>
  );
}
