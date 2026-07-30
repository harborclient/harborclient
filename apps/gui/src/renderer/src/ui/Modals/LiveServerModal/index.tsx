import { useCallback, useId, type JSX } from 'react';
import toast from 'react-hot-toast';
import {
  Button,
  Checkbox,
  FormGroup,
  Input,
  Modal,
  ModalFormLayout
} from '@harborclient/sdk/components';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
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
  setLiveServerModalWatch
} from '#/renderer/src/store/slices/modalsSlice';
import {
  createSavedLiveServer,
  startLiveServer,
  toLiveServerConfig,
  updateSavedLiveServer
} from '#/renderer/src/store/thunks/liveServers';
import { formatErrorMessage } from '#/renderer/src/ui/Modals/dialogHelpers';
import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/useSidebarExpansion';
import { AliasList } from './AliasList';
import { CorsSettings } from './CorsSettings';

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
 * Modal for configuring, saving, and starting a live server.
 */
export function LiveServerModal(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const modal = useAppSelector(selectLiveServerModal);
  const { setActiveSidebarMode } = useSidebarExpansion();
  const titleId = useId();
  const nameId = useId();
  const rootId = useId();
  const portId = useId();
  const watchId = useId();

  /**
   * Closes the modal when not busy.
   */
  const handleClose = useCallback((): void => {
    if (modal?.busy) {
      return;
    }
    dispatch(closeLiveServerModal());
  }, [dispatch, modal?.busy]);

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
   * Builds a normalized config from the modal fields, or sets an inline error.
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

  if (!modal) {
    return null;
  }

  const title = modal.mode === 'edit' ? 'Edit Live Server' : 'New Live Server';
  const busy = modal.busy;

  return (
    <Modal
      className="w-[560px]"
      overlayClassName="z-[60]"
      labelledBy={titleId}
      onClose={handleClose}
      title={title}
      description="Serve a local folder over HTTP and open it in a Live Page."
    >
      <ModalFormLayout
        error={modal.submitError}
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void handleSave()}
            >
              Save
            </Button>
            <Button
              type="button"
              disabled={busy || !modal.root.trim()}
              onClick={() => void handleStart()}
            >
              Start Server
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FormGroup label="Name" htmlFor={nameId}>
            <Input
              id={nameId}
              autoFocus
              value={modal.name}
              disabled={busy}
              placeholder="My site"
              onChange={(event) => dispatch(setLiveServerModalName(event.target.value))}
            />
          </FormGroup>

          <FormGroup label="Root directory" htmlFor={rootId}>
            <div className="flex gap-2">
              <Input
                id={rootId}
                className="min-w-0 flex-1"
                value={modal.root}
                disabled={busy}
                placeholder="/path/to/site"
                onChange={(event) => dispatch(setLiveServerModalRoot(event.target.value))}
              />
              <Button type="button" variant="secondary" disabled={busy} onClick={handleBrowse}>
                Browse
              </Button>
            </div>
          </FormGroup>

          <FormGroup
            label="Port"
            htmlFor={portId}
            description="Leave blank to use the next free port from 5500."
          >
            <Input
              id={portId}
              inputMode="numeric"
              value={modal.port}
              disabled={busy}
              placeholder="Auto"
              onChange={(event) => dispatch(setLiveServerModalPort(event.target.value))}
            />
          </FormGroup>

          <AliasList
            aliases={modal.aliases}
            disabled={busy}
            onChange={(next) => dispatch(setLiveServerModalAliases(next))}
          />

          <CorsSettings
            cors={modal.cors}
            disabled={busy}
            onChange={(next) => dispatch(setLiveServerModalCors(next))}
          />

          <label htmlFor={watchId} className="flex items-center gap-2">
            <Checkbox
              id={watchId}
              checked={modal.watch}
              disabled={busy}
              onChange={(event) => dispatch(setLiveServerModalWatch(event.target.checked))}
            />
            <span>Reload page when files change</span>
          </label>
        </div>
      </ModalFormLayout>
    </Modal>
  );
}
