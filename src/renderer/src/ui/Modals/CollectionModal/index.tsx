import { useCallback, useEffect, useId, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  closeCollectionModal,
  selectCollectionModal,
  setCollectionModalGitCollectionCreated,
  setCollectionModalGitCreatedConnectionId,
  setCollectionModalGitDraft,
  setCollectionModalShareTokenInput,
  setCollectionModalName,
  setCollectionModalProviderId,
  setCollectionModalSubmitError,
  setCollectionModalTab
} from '#/renderer/src/store/slices/modalsSlice';
import {
  joinSharedCollection,
  createCollection,
  createGitCollection,
  createGitConnectionForCollection,
  deleteOrphanGitConnection,
  importCollection,
  saveRequest
} from '#/renderer/src/store/thunks';
import { SegmentedTabs, SegmentedTabPanel, SegmentedTabsGroup } from '@harborclient/sdk/components';
import { Button } from '@harborclient/sdk/components';
import { FormGroup } from '@harborclient/sdk/components';
import { providerOptionLabel, useProviders } from '#/renderer/src/hooks/useProviders';
import { Input, Select, Textarea } from '@harborclient/sdk/components';
import { Modal, ModalFooter } from '@harborclient/sdk/components';
import { FieldError } from '@harborclient/sdk/components';
import { StatusMessage } from '@harborclient/sdk/components';
import { formatErrorMessage } from '#/renderer/src/ui/Modals/dialogHelpers';
import { useSidebarGit } from '#/renderer/src/ui/Sidebars/CollectionSidebar/sidebarGitContext';

import { GitTabPanel } from './GitTabPanel';

/**
 * Modal for creating a collection, importing from file, joining a shared collection, or linking Git.
 */
export function CollectionModal(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const collectionModal = useAppSelector(selectCollectionModal);
  const { refreshGitSidebar } = useSidebarGit();
  const [gitBusy, setGitBusy] = useState(false);
  const {
    providers,
    primaryProviderId,
    loading: providersLoading,
    error: providersError
  } = useProviders([], { excludeAdminTeamHubs: true, excludeGit: true });
  const providerSelectId = useId();

  /**
   * Defaults the provider dropdown to the active database when the modal opens.
   */
  useEffect(() => {
    if (!collectionModal || collectionModal.providerId || !primaryProviderId) return;
    dispatch(setCollectionModalProviderId(primaryProviderId));
  }, [collectionModal, dispatch, primaryProviderId]);

  /**
   * Removes an orphaned git connection created during a canceled Git tab flow.
   */
  const cleanupOrphanGitConnection = useCallback(async (): Promise<void> => {
    if (!collectionModal?.gitCreatedConnectionId || collectionModal.gitCollectionCreated) {
      return;
    }

    try {
      await dispatch(deleteOrphanGitConnection(collectionModal.gitCreatedConnectionId)).unwrap();
    } catch {
      // Best-effort cleanup when the user dismisses before collection creation.
    }
  }, [collectionModal, dispatch]);

  /**
   * Closes the collection modal and resets modal state.
   */
  const handleClose = useCallback((): void => {
    void cleanupOrphanGitConnection().finally(() => {
      dispatch(closeCollectionModal());
    });
  }, [cleanupOrphanGitConnection, dispatch]);

  /**
   * Creates a collection, optionally saving the current draft into it.
   */
  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!collectionModal) return;
    const name = collectionModal.name.trim();
    if (!name) return;
    dispatch(setCollectionModalSubmitError(null));
    try {
      const providerId = collectionModal.providerId || primaryProviderId || undefined;
      const collection = await dispatch(createCollection({ name, providerId })).unwrap();
      if (collectionModal.mode === 'create-and-save') {
        await dispatch(saveRequest(collection.id)).unwrap();
        toast.success('Request saved');
      }
      dispatch(closeCollectionModal());
    } catch (err) {
      dispatch(
        setCollectionModalSubmitError(
          formatErrorMessage(
            err,
            collectionModal.mode === 'create-and-save'
              ? 'Failed to save request'
              : 'Failed to create collection'
          )
        )
      );
    }
  }, [collectionModal, dispatch, primaryProviderId]);

  /**
   * Creates a git-backed collection, optionally initializing the repo first.
   */
  const handleGitCreate = useCallback(
    async (options: { initGitRepo: boolean }): Promise<void> => {
      if (!collectionModal) return;
      const name = collectionModal.name.trim();
      const { repoPath, url, branch, subdir } = collectionModal.gitDraft.settings;
      if (!name || !repoPath.trim() || !url.trim()) return;

      dispatch(setCollectionModalSubmitError(null));
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
        dispatch(setCollectionModalGitCreatedConnectionId(saved.id));
        const collection = await dispatch(
          createGitCollection({
            name,
            connectionId: saved.id
          })
        ).unwrap();
        dispatch(setCollectionModalGitCollectionCreated(true));
        refreshGitSidebar();
        if (collectionModal.mode === 'create-and-save') {
          await dispatch(saveRequest(collection.id)).unwrap();
          toast.success('Request saved');
        } else {
          toast.success('Collection created');
        }
        dispatch(closeCollectionModal());
      } catch (err) {
        dispatch(
          setCollectionModalSubmitError(
            formatErrorMessage(
              err,
              collectionModal.mode === 'create-and-save'
                ? 'Failed to save request'
                : 'Failed to create collection'
            )
          )
        );
      } finally {
        setGitBusy(false);
      }
    },
    [collectionModal, dispatch, refreshGitSidebar]
  );

  /**
   * Imports a collection from a JSON file selected via a native dialog.
   */
  const handleImport = useCallback(async (): Promise<void> => {
    dispatch(setCollectionModalSubmitError(null));
    try {
      const collection = await dispatch(importCollection()).unwrap();
      if (!collection) return;
      toast.success('Collection imported');
      dispatch(closeCollectionModal());
    } catch (err) {
      dispatch(
        setCollectionModalSubmitError(formatErrorMessage(err, 'Failed to import collection'))
      );
    }
  }, [dispatch]);

  /**
   * Joins a shared collection from a share JWT and adds the embedded database connection.
   */
  const handleJoinSharedCollection = useCallback(async (): Promise<void> => {
    if (!collectionModal) return;
    const token = collectionModal.shareTokenInput.trim();
    if (!token) return;
    dispatch(setCollectionModalSubmitError(null));
    try {
      await dispatch(joinSharedCollection(token)).unwrap();
    } catch (err) {
      dispatch(
        setCollectionModalSubmitError(formatErrorMessage(err, 'Failed to join shared collection'))
      );
    }
  }, [collectionModal, dispatch]);

  if (!collectionModal) return null;

  const showImportTab = collectionModal.mode === 'create';
  const resolvedProviderId = collectionModal.providerId || primaryProviderId;
  const providerSelectDisabled =
    providersLoading || providersError != null || providers.length === 0;

  /**
   * Renders the provider selector used when creating a collection.
   */
  const providerField = (
    <div className="mt-3">
      <FormGroup label="Storage location" htmlFor={providerSelectId} labelTone="muted">
        <Select
          id={providerSelectId}
          className="w-full"
          value={resolvedProviderId}
          disabled={providerSelectDisabled}
          onChange={(e) => dispatch(setCollectionModalProviderId(e.target.value))}
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
  );

  const modalTitle = showImportTab ? 'Add collection' : 'New collection';

  return (
    <Modal
      onClose={handleClose}
      className={showImportTab ? 'h-[80vh] w-[min(60rem,calc(100vw-2rem))]' : 'w-[32rem]'}
      labelledBy="collection-modal-title"
      title={modalTitle}
      description={
        collectionModal.mode === 'create-and-save'
          ? 'Create a collection to save this request into.'
          : undefined
      }
    >
      {showImportTab ? (
        <SegmentedTabsGroup
          value={collectionModal.tab}
          onChange={(tab) => dispatch(setCollectionModalTab(tab))}
          ariaLabel="Add collection options"
        >
          <div className="-mx-4 -mt-4 mb-4">
            <SegmentedTabs
              fullWidth
              editable={false}
              className="[&_button]:whitespace-nowrap"
              tabs={[
                { value: 'create', label: 'Storage' },
                { value: 'git', label: 'Git' },
                { value: 'import', label: 'Import' },
                { value: 'join', label: 'Join collection' }
              ]}
            />
          </div>

          {collectionModal.submitError && (
            <FieldError spacing="section" className="mb-3 mt-0">
              {collectionModal.submitError}
            </FieldError>
          )}

          <SegmentedTabPanel value="join">
            <p className="mb-3 text-muted">
              Paste a share token from a trusted sender. Add their public key under File → Sharing
              Keys first. Restart HarborClient after joining to load collections from that database.
            </p>
            <Textarea
              className="min-h-28 w-full resize-y font-mono"
              autoFocus
              placeholder="Paste share token"
              value={collectionModal.shareTokenInput}
              onChange={(e) => dispatch(setCollectionModalShareTokenInput(e.target.value))}
            />
            <ModalFooter spaced>
              <Button
                onClick={() => void handleJoinSharedCollection()}
                disabled={!collectionModal.shareTokenInput.trim()}
              >
                Join
              </Button>
            </ModalFooter>
          </SegmentedTabPanel>

          <SegmentedTabPanel value="create">
            <FormGroup label="Collection name" labelTone="muted">
              <Input
                className="w-full"
                type="text"
                autoFocus
                value={collectionModal.name}
                onChange={(e) => dispatch(setCollectionModalName(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSubmit();
                }}
              />
            </FormGroup>
            {providerField}
            <ModalFooter spaced>
              <Button
                onClick={() => void handleSubmit()}
                disabled={!collectionModal.name.trim() || providerSelectDisabled}
              >
                {collectionModal.mode === 'create-and-save' ? 'Create & Save' : 'Create'}
              </Button>
            </ModalFooter>
          </SegmentedTabPanel>

          <SegmentedTabPanel value="git">
            <GitTabPanel
              name={collectionModal.name}
              gitDraft={collectionModal.gitDraft}
              busy={gitBusy}
              createAndSave={collectionModal.mode === 'create-and-save'}
              onNameChange={(nextName) => dispatch(setCollectionModalName(nextName))}
              onGitDraftChange={(connection) => {
                if (connection.type === 'git') {
                  dispatch(setCollectionModalGitDraft(connection));
                }
              }}
              onCreate={(options) => void handleGitCreate(options)}
              onAuthValidationError={(message) => dispatch(setCollectionModalSubmitError(message))}
            />
          </SegmentedTabPanel>

          <SegmentedTabPanel value="import">
            <p className="mb-4 text-muted">
              Choose a HarborClient or Postman collection export (.json), a Bruno collection
              manifest (bruno.json), or a browser HAR capture (.har) to import all saved requests.
            </p>
            <ModalFooter>
              <Button onClick={() => void handleImport()}>Import file</Button>
            </ModalFooter>
          </SegmentedTabPanel>
        </SegmentedTabsGroup>
      ) : (
        <>
          {collectionModal.submitError && (
            <FieldError spacing="section" className="mb-3 mt-0">
              {collectionModal.submitError}
            </FieldError>
          )}
          <FormGroup label="Collection name" labelTone="muted">
            <Input
              className="w-full"
              type="text"
              autoFocus
              value={collectionModal.name}
              onChange={(e) => dispatch(setCollectionModalName(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSubmit();
              }}
            />
          </FormGroup>
          {providerField}
          <ModalFooter spaced>
            <Button
              onClick={() => void handleSubmit()}
              disabled={!collectionModal.name.trim() || providerSelectDisabled}
            >
              {collectionModal.mode === 'create-and-save' ? 'Create & Save' : 'Create'}
            </Button>
          </ModalFooter>
        </>
      )}
    </Modal>
  );
}
