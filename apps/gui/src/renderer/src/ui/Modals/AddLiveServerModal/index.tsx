import { useCallback, useEffect, useId, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import { RUNTIME_CATALOG, type RuntimeRequirement } from '@harborclient/core/types';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  closeAddLiveServerModal,
  selectAddLiveServerModal,
  setAddLiveServerModalGitConnectionCommitted,
  setAddLiveServerModalGitCreatedConnectionId,
  setAddLiveServerModalGitDraft,
  setAddLiveServerModalName,
  setAddLiveServerModalProviderId,
  setAddLiveServerModalSubmitError,
  setAddLiveServerModalTab
} from '#/renderer/src/store/slices/modalsSlice';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import { deleteOrphanGitConnection } from '#/renderer/src/store/thunks';
import { createGitConnectionForCollection } from '#/renderer/src/store/thunks/collections';
import { importLiveServer, openLiveServerEditor } from '#/renderer/src/store/thunks/liveServers';
import { SegmentedTabs, SegmentedTabPanel, SegmentedTabsGroup } from '@harborclient/sdk/components';
import { Button } from '@harborclient/sdk/components';
import { FormGroup } from '@harborclient/sdk/components';
import { providerOptionLabel, useProviders } from '#/renderer/src/hooks/useProviders';
import { Input, Select } from '@harborclient/sdk/components';
import { Modal, ModalFooter } from '@harborclient/sdk/components';
import { FieldError } from '@harborclient/sdk/components';
import { StatusMessage } from '@harborclient/sdk/components';
import { formatErrorMessage } from '#/renderer/src/ui/Modals/dialogHelpers';
import { useSidebarGit } from '#/renderer/src/ui/Sidebars/CollectionSidebar/git/sidebarGitContext';
import { GitCreateForm } from '#/renderer/src/ui/Shared/Git/GitCreateForm';
import { setPendingRuntimeDraft } from '#/renderer/src/ui/Tabs/Settings/RuntimesSection/pendingRuntimeDraft';
import { joinRepoDocumentRoot } from './joinRepoDocumentRoot';

/**
 * Modal for adding a live server via storage provider, git connection, or file import.
 */
export function AddLiveServerModal(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const addLiveServerModal = useAppSelector(selectAddLiveServerModal);
  const { refreshGitSidebar } = useSidebarGit();
  const [gitBusy, setGitBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [unresolvedRuntime, setUnresolvedRuntime] = useState<RuntimeRequirement | null>(null);
  const {
    providers,
    primaryProviderId,
    loading: providersLoading,
    error: providersError
  } = useProviders([], { excludeAdminTeamHubs: true, excludeGit: true });
  const providerSelectId = useId();
  const serverNameId = useId();

  /**
   * Defaults the provider dropdown to the active database when the modal opens.
   */
  useEffect(() => {
    if (!addLiveServerModal || addLiveServerModal.providerId || !primaryProviderId) return;
    dispatch(setAddLiveServerModalProviderId(primaryProviderId));
  }, [addLiveServerModal, dispatch, primaryProviderId]);

  /**
   * Removes an orphaned git connection created during a canceled Git tab flow.
   */
  const cleanupOrphanGitConnection = useCallback(async (): Promise<void> => {
    if (!addLiveServerModal?.gitCreatedConnectionId || addLiveServerModal.gitConnectionCommitted) {
      return;
    }

    try {
      await dispatch(deleteOrphanGitConnection(addLiveServerModal.gitCreatedConnectionId)).unwrap();
    } catch {
      // Best-effort cleanup when the user dismisses before editor handoff.
    }
  }, [addLiveServerModal, dispatch]);

  /**
   * Closes the modal and resets state after optional orphan git cleanup.
   */
  const handleClose = useCallback((): void => {
    void cleanupOrphanGitConnection().finally(() => {
      dispatch(closeAddLiveServerModal());
    });
  }, [cleanupOrphanGitConnection, dispatch]);

  /**
   * Opens the live-server footer editor with the Storage tab name and provider.
   */
  const handleStorageCreate = useCallback((): void => {
    if (!addLiveServerModal) return;
    const name = addLiveServerModal.name.trim();
    if (!name) return;

    const connectionId = addLiveServerModal.providerId || primaryProviderId || '';
    dispatch(setAddLiveServerModalSubmitError(null));
    void dispatch(
      openLiveServerEditor({
        mode: 'create',
        name,
        connectionId: connectionId || undefined
      })
    );
    dispatch(closeAddLiveServerModal());
  }, [addLiveServerModal, dispatch, primaryProviderId]);

  /**
   * Creates a git storage connection, then opens the live-server editor prefilled.
   *
   * @param options - Whether to initialize a new git repository at the path.
   */
  const handleGitCreate = useCallback(
    async (options: { initGitRepo: boolean }): Promise<void> => {
      if (!addLiveServerModal) return;
      const name = addLiveServerModal.name.trim();
      const { repoPath, url, branch, subdir } = addLiveServerModal.gitDraft.settings;
      if (!name || !repoPath.trim() || !url.trim()) return;

      dispatch(setAddLiveServerModalSubmitError(null));
      setGitBusy(true);
      try {
        const saved = await dispatch(
          createGitConnectionForCollection({
            name,
            repoPath,
            url,
            branch,
            subdir,
            initGitRepo: options.initGitRepo
          })
        ).unwrap();
        dispatch(setAddLiveServerModalGitCreatedConnectionId(saved.id));
        refreshGitSidebar();
        dispatch(setAddLiveServerModalGitConnectionCommitted(true));
        await dispatch(
          openLiveServerEditor({
            mode: 'create',
            name,
            connectionId: saved.id,
            root: joinRepoDocumentRoot(repoPath, subdir)
          })
        );
        dispatch(closeAddLiveServerModal());
      } catch (err) {
        dispatch(
          setAddLiveServerModalSubmitError(
            formatErrorMessage(err, 'Failed to create git live server connection')
          )
        );
      } finally {
        setGitBusy(false);
      }
    },
    [addLiveServerModal, dispatch, refreshGitSidebar]
  );

  /**
   * Imports a HarborClient live-server export from a file selected via a native dialog.
   */
  const handleImport = useCallback(async (): Promise<void> => {
    dispatch(setAddLiveServerModalSubmitError(null));
    setUnresolvedRuntime(null);
    setImportBusy(true);
    try {
      const result = await dispatch(importLiveServer()).unwrap();
      if (!result) return;
      if (result.unresolvedRuntime != null) {
        setUnresolvedRuntime(result.unresolvedRuntime);
      }
      toast.success('Live server imported');
    } catch (err) {
      dispatch(
        setAddLiveServerModalSubmitError(formatErrorMessage(err, 'Failed to import live server'))
      );
    } finally {
      setImportBusy(false);
    }
  }, [dispatch]);

  /**
   * Opens Settings → Runtimes with the missing requirement prefilled.
   */
  const handleAddMissingRuntime = useCallback((): void => {
    if (unresolvedRuntime == null) {
      return;
    }
    setPendingRuntimeDraft({
      kind: unresolvedRuntime.kind,
      version: unresolvedRuntime.version,
      name: unresolvedRuntime.name
    });
    dispatch(closeAddLiveServerModal());
    dispatch(openPageTab({ type: 'settings', section: 'runtimes' }));
  }, [dispatch, unresolvedRuntime]);

  if (!addLiveServerModal) return null;

  const resolvedProviderId = addLiveServerModal.providerId || primaryProviderId;
  const providerSelectDisabled =
    providersLoading || providersError != null || providers.length === 0;

  return (
    <Modal
      onClose={handleClose}
      className="w-[min(60rem,calc(100vw-2rem))]"
      labelledBy="add-live-server-modal-title"
      title="Add Live Server"
    >
      <SegmentedTabsGroup
        value={addLiveServerModal.tab}
        onChange={(tab) => dispatch(setAddLiveServerModalTab(tab))}
        ariaLabel="Add Live Server options"
      >
        <div className="-mx-4 -mt-4 mb-4">
          <SegmentedTabs
            fullWidth
            editable={false}
            className="[&_button]:whitespace-nowrap"
            tabs={[
              { value: 'storage', label: 'Storage' },
              { value: 'git', label: 'Git' },
              { value: 'import', label: 'Import' }
            ]}
          />
        </div>

        {addLiveServerModal.submitError && (
          <FieldError spacing="section" className="mb-3 mt-0">
            {addLiveServerModal.submitError}
          </FieldError>
        )}

        {unresolvedRuntime != null ? (
          <p className="mb-3 text-danger" role="status">
            This server needs a {RUNTIME_CATALOG[unresolvedRuntime.kind].label}{' '}
            {unresolvedRuntime.version} runtime
            {unresolvedRuntime.name ? ` (“${unresolvedRuntime.name}”)` : ''}.{' '}
            <button type="button" className="underline" onClick={handleAddMissingRuntime}>
              Add it in Settings → Runtimes
            </button>
            .
          </p>
        ) : null}

        <SegmentedTabPanel value="storage">
          <FormGroup label="Server name" htmlFor={serverNameId} labelTone="muted">
            <Input
              id={serverNameId}
              className="w-full"
              type="text"
              autoFocus
              value={addLiveServerModal.name}
              onChange={(e) => dispatch(setAddLiveServerModalName(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleStorageCreate();
              }}
            />
          </FormGroup>
          <div className="mt-3">
            <FormGroup label="Storage location" htmlFor={providerSelectId} labelTone="muted">
              <Select
                id={providerSelectId}
                className="w-full"
                value={resolvedProviderId}
                disabled={providerSelectDisabled}
                onChange={(e) => dispatch(setAddLiveServerModalProviderId(e.target.value))}
              >
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name || 'Untitled'} ({providerOptionLabel(provider)})
                  </option>
                ))}
              </Select>
              {providersLoading && (
                <StatusMessage live={false} className="mb-0 mt-1">
                  Loading…
                </StatusMessage>
              )}
              {providersError && (
                <FieldError spacing="field" className="mb-0 mt-1">
                  {providersError}
                </FieldError>
              )}
            </FormGroup>
          </div>
          <ModalFooter spaced>
            <Button
              type="button"
              onClick={handleStorageCreate}
              disabled={!addLiveServerModal.name.trim() || providerSelectDisabled}
            >
              Create
            </Button>
          </ModalFooter>
        </SegmentedTabPanel>

        <SegmentedTabPanel value="git">
          <GitCreateForm
            name={addLiveServerModal.name}
            nameLabel="Server name"
            entityNoun="live server"
            gitDraft={addLiveServerModal.gitDraft}
            busy={gitBusy}
            createAndSave={false}
            onNameChange={(nextName) => dispatch(setAddLiveServerModalName(nextName))}
            onGitDraftChange={(connection) => {
              if (connection.type === 'git') {
                dispatch(setAddLiveServerModalGitDraft(connection));
              }
            }}
            onCreate={(options) => void handleGitCreate(options)}
          />
        </SegmentedTabPanel>

        <SegmentedTabPanel value="import">
          <p className="mb-4 text-muted">
            Choose a HarborClient live server export (.json) to import a saved server configuration.
          </p>
          <ModalFooter spaced>
            <Button type="button" disabled={importBusy} onClick={() => void handleImport()}>
              {importBusy ? 'Importing…' : 'Import file'}
            </Button>
          </ModalFooter>
        </SegmentedTabPanel>
      </SegmentedTabsGroup>
    </Modal>
  );
}
