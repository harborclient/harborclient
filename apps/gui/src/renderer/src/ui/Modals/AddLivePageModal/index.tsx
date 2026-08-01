import { useCallback, useEffect, useId, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  closeAddLivePageModal,
  selectAddLivePageModal,
  setAddLivePageModalGitConnectionCommitted,
  setAddLivePageModalGitCreatedConnectionId,
  setAddLivePageModalGitDraft,
  setAddLivePageModalName,
  setAddLivePageModalProviderId,
  setAddLivePageModalSubmitError,
  setAddLivePageModalTab,
  setAddLivePageModalUrl
} from '#/renderer/src/store/slices/modalsSlice';
import { deleteOrphanGitConnection } from '#/renderer/src/store/thunks';
import { createGitConnectionForCollection } from '#/renderer/src/store/thunks/collections';
import { createLivePageFromModal, importWebsite } from '#/renderer/src/store/thunks/websites';
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

/**
 * Modal for adding a live page via storage provider, git connection, or file import.
 */
export function AddLivePageModal(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const addLivePageModal = useAppSelector(selectAddLivePageModal);
  const { refreshGitSidebar } = useSidebarGit();
  const [gitBusy, setGitBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [storageBusy, setStorageBusy] = useState(false);
  const {
    providers,
    primaryProviderId,
    loading: providersLoading,
    error: providersError
  } = useProviders([], { excludeAdminTeamHubs: true, excludeGit: true });
  const providerSelectId = useId();
  const pageNameId = useId();
  const pageUrlId = useId();
  const gitUrlId = useId();

  /**
   * Defaults the provider dropdown to the active database when the modal opens.
   */
  useEffect(() => {
    if (!addLivePageModal || addLivePageModal.providerId || !primaryProviderId) return;
    dispatch(setAddLivePageModalProviderId(primaryProviderId));
  }, [addLivePageModal, dispatch, primaryProviderId]);

  /**
   * Removes an orphaned git connection created during a canceled Git tab flow.
   */
  const cleanupOrphanGitConnection = useCallback(async (): Promise<void> => {
    if (!addLivePageModal?.gitCreatedConnectionId || addLivePageModal.gitConnectionCommitted) {
      return;
    }

    try {
      await dispatch(deleteOrphanGitConnection(addLivePageModal.gitCreatedConnectionId)).unwrap();
    } catch {
      // Best-effort cleanup when the user dismisses before live-page creation.
    }
  }, [addLivePageModal, dispatch]);

  /**
   * Closes the modal and resets state after optional orphan git cleanup.
   */
  const handleClose = useCallback((): void => {
    void cleanupOrphanGitConnection().finally(() => {
      dispatch(closeAddLivePageModal());
    });
  }, [cleanupOrphanGitConnection, dispatch]);

  /**
   * Persists a live page from the Storage tab name, URL, and provider.
   */
  const handleStorageCreate = useCallback(async (): Promise<void> => {
    if (!addLivePageModal) return;
    const name = addLivePageModal.name.trim();
    if (!name) return;

    const connectionId = addLivePageModal.providerId || primaryProviderId || '';
    dispatch(setAddLivePageModalSubmitError(null));
    setStorageBusy(true);
    try {
      await dispatch(
        createLivePageFromModal({
          name,
          url: addLivePageModal.url,
          connectionId: connectionId || undefined
        })
      ).unwrap();
      dispatch(closeAddLivePageModal());
    } catch (err) {
      dispatch(
        setAddLivePageModalSubmitError(formatErrorMessage(err, 'Failed to create live page'))
      );
    } finally {
      setStorageBusy(false);
    }
  }, [addLivePageModal, dispatch, primaryProviderId]);

  /**
   * Creates a git storage connection, then persists a live page on that connection.
   *
   * @param options - Whether to initialize a new git repository at the path.
   */
  const handleGitCreate = useCallback(
    async (options: { initGitRepo: boolean }): Promise<void> => {
      if (!addLivePageModal) return;
      const name = addLivePageModal.name.trim();
      const { repoPath, url, branch, subdir } = addLivePageModal.gitDraft.settings;
      if (!name || !repoPath.trim() || !url.trim()) return;

      dispatch(setAddLivePageModalSubmitError(null));
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
        dispatch(setAddLivePageModalGitCreatedConnectionId(saved.id));
        refreshGitSidebar();
        await dispatch(
          createLivePageFromModal({
            name,
            url: addLivePageModal.url,
            connectionId: saved.id
          })
        ).unwrap();
        dispatch(setAddLivePageModalGitConnectionCommitted(true));
        dispatch(closeAddLivePageModal());
      } catch (err) {
        dispatch(
          setAddLivePageModalSubmitError(
            formatErrorMessage(err, 'Failed to create git live page connection')
          )
        );
      } finally {
        setGitBusy(false);
      }
    },
    [addLivePageModal, dispatch, refreshGitSidebar]
  );

  /**
   * Imports a HarborClient live-page export from a file selected via a native dialog.
   */
  const handleImport = useCallback(async (): Promise<void> => {
    dispatch(setAddLivePageModalSubmitError(null));
    setImportBusy(true);
    try {
      const website = await dispatch(importWebsite()).unwrap();
      if (!website) return;
      toast.success('Live page imported');
    } catch (err) {
      dispatch(
        setAddLivePageModalSubmitError(formatErrorMessage(err, 'Failed to import live page'))
      );
    } finally {
      setImportBusy(false);
    }
  }, [dispatch]);

  if (!addLivePageModal) return null;

  const resolvedProviderId = addLivePageModal.providerId || primaryProviderId;
  const providerSelectDisabled =
    providersLoading || providersError != null || providers.length === 0;
  const storageCreateDisabled =
    !addLivePageModal.name.trim() || providerSelectDisabled || storageBusy;

  return (
    <Modal
      onClose={handleClose}
      className="w-[min(60rem,calc(100vw-2rem))]"
      labelledBy="add-live-page-modal-title"
      title="Add Live Page"
    >
      <SegmentedTabsGroup
        value={addLivePageModal.tab}
        onChange={(tab) => dispatch(setAddLivePageModalTab(tab))}
        ariaLabel="Add Live Page options"
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

        {addLivePageModal.submitError && (
          <FieldError spacing="section" className="mb-3 mt-0">
            {addLivePageModal.submitError}
          </FieldError>
        )}

        <SegmentedTabPanel value="storage">
          <FormGroup label="Page name" htmlFor={pageNameId} labelTone="muted">
            <Input
              id={pageNameId}
              className="w-full"
              type="text"
              autoFocus
              value={addLivePageModal.name}
              onChange={(e) => dispatch(setAddLivePageModalName(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleStorageCreate();
              }}
            />
          </FormGroup>
          <div className="mt-3">
            <FormGroup label="URL" htmlFor={pageUrlId} labelTone="muted">
              <Input
                id={pageUrlId}
                className="w-full"
                type="url"
                value={addLivePageModal.url}
                onChange={(e) => dispatch(setAddLivePageModalUrl(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleStorageCreate();
                }}
              />
            </FormGroup>
          </div>
          <div className="mt-3">
            <FormGroup label="Storage location" htmlFor={providerSelectId} labelTone="muted">
              <Select
                id={providerSelectId}
                className="w-full"
                value={resolvedProviderId}
                disabled={providerSelectDisabled}
                onChange={(e) => dispatch(setAddLivePageModalProviderId(e.target.value))}
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
              onClick={() => void handleStorageCreate()}
              disabled={storageCreateDisabled}
            >
              {storageBusy ? 'Creating…' : 'Create'}
            </Button>
          </ModalFooter>
        </SegmentedTabPanel>

        <SegmentedTabPanel value="git">
          <div className="mb-3">
            <FormGroup label="URL" htmlFor={gitUrlId} labelTone="muted">
              <Input
                id={gitUrlId}
                className="w-full"
                type="url"
                value={addLivePageModal.url}
                onChange={(e) => dispatch(setAddLivePageModalUrl(e.target.value))}
              />
            </FormGroup>
          </div>
          <GitCreateForm
            name={addLivePageModal.name}
            nameLabel="Page name"
            entityNoun="live page"
            gitDraft={addLivePageModal.gitDraft}
            busy={gitBusy}
            createAndSave={false}
            onNameChange={(nextName) => dispatch(setAddLivePageModalName(nextName))}
            onGitDraftChange={(connection) => {
              if (connection.type === 'git') {
                dispatch(setAddLivePageModalGitDraft(connection));
              }
            }}
            onCreate={(options) => void handleGitCreate(options)}
          />
        </SegmentedTabPanel>

        <SegmentedTabPanel value="import">
          <p className="mb-4 text-muted">
            Choose a HarborClient live page export (.json) to import a saved page configuration.
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
