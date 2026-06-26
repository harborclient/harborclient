import { useCallback, useEffect, useId, type JSX } from 'react';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  closeCollectionModal,
  selectCollectionModal,
  setCollectionModalShareTokenInput,
  setCollectionModalName,
  setCollectionModalProviderId,
  setCollectionModalSubmitError,
  setCollectionModalTab
} from '#/renderer/src/store/slices/modalsSlice';
import {
  joinSharedCollection,
  createCollection,
  importCollection,
  saveRequest
} from '#/renderer/src/store/thunks';
import {
  SegmentedTabs,
  SegmentedTabPanel,
  SegmentedTabsGroup
} from '#/renderer/src/components/SegmentedTabs';
import { Button } from '#/renderer/src/components/Button';
import { providerOptionLabel, useProviders } from '#/renderer/src/hooks/useProviders';
import { Input, Select, Textarea } from '#/renderer/src/components/forms';
import { Modal } from '#/renderer/src/components/Modal';
import { formatErrorMessage } from '#/renderer/src/ui/modals/dialogHelpers';

/**
 * Modal for creating a collection, importing from file, or joining a shared collection.
 */
export function CollectionModal(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const collectionModal = useAppSelector(selectCollectionModal);
  const {
    providers,
    primaryProviderId,
    loading: providersLoading,
    error: providersError
  } = useProviders([], { excludeAdminTeamHubs: true });
  const providerSelectId = useId();

  /**
   * Defaults the provider dropdown to the active database when the modal opens.
   */
  useEffect(() => {
    if (!collectionModal || collectionModal.providerId || !primaryProviderId) return;
    dispatch(setCollectionModalProviderId(primaryProviderId));
  }, [collectionModal, dispatch, primaryProviderId]);

  /**
   * Closes the collection modal and resets modal state.
   */
  const handleClose = useCallback((): void => {
    dispatch(closeCollectionModal());
  }, [dispatch]);

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
      <label className="mb-1 block text-[14px] text-muted" htmlFor={providerSelectId}>
        Storage location
      </label>
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
      {providersLoading && <p className="mb-0 mt-1 text-[14px] text-muted">Loading…</p>}
      {providersError && <p className="mb-0 mt-1 text-[14px] text-danger">{providersError}</p>}
    </div>
  );

  const modalTitle = showImportTab ? 'Add collection' : 'New collection';

  return (
    <Modal
      onClose={handleClose}
      className={showImportTab ? 'w-[40rem]' : 'w-[32rem]'}
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
          <SegmentedTabs
            fullWidth
            className="mb-3"
            tabs={[
              { value: 'create', label: 'Create new' },
              { value: 'import', label: 'Import from file' },
              { value: 'join', label: 'Join shared collection' }
            ]}
          />

          {collectionModal.submitError && (
            <p className="mb-3 text-[14px] text-danger">{collectionModal.submitError}</p>
          )}

          <SegmentedTabPanel value="join">
            <p className="mb-3 text-[14px] text-muted">
              Paste a share token from a trusted sender. Add their public key under File → Sharing
              Keys first. Restart HarborClient after joining to load collections from that database.
            </p>
            <Textarea
              className="min-h-28 w-full resize-y font-mono text-[14px]"
              autoFocus
              placeholder="Paste share token"
              value={collectionModal.shareTokenInput}
              onChange={(e) => dispatch(setCollectionModalShareTokenInput(e.target.value))}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button
                onClick={() => void handleJoinSharedCollection()}
                disabled={!collectionModal.shareTokenInput.trim()}
              >
                Join
              </Button>
            </div>
          </SegmentedTabPanel>

          <SegmentedTabPanel value="create">
            <Input
              className="w-full"
              type="text"
              autoFocus
              placeholder="Collection name"
              value={collectionModal.name}
              onChange={(e) => dispatch(setCollectionModalName(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSubmit();
              }}
            />
            {providerField}
            <div className="mt-4 flex justify-end gap-2">
              <Button
                onClick={() => void handleSubmit()}
                disabled={!collectionModal.name.trim() || providerSelectDisabled}
              >
                {collectionModal.mode === 'create-and-save' ? 'Create & Save' : 'Create'}
              </Button>
            </div>
          </SegmentedTabPanel>

          <SegmentedTabPanel value="import">
            <p className="mb-4 text-[14px] text-muted">
              Choose a HarborClient or Postman collection export (.json) to import all saved
              requests.
            </p>
            <div className="flex justify-end gap-2">
              <Button onClick={() => void handleImport()}>Import .json</Button>
            </div>
          </SegmentedTabPanel>
        </SegmentedTabsGroup>
      ) : (
        <>
          {collectionModal.submitError && (
            <p className="mb-3 text-[14px] text-danger">{collectionModal.submitError}</p>
          )}
          <Input
            className="w-full"
            type="text"
            autoFocus
            placeholder="Collection name"
            value={collectionModal.name}
            onChange={(e) => dispatch(setCollectionModalName(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSubmit();
            }}
          />
          {providerField}
          <div className="mt-4 flex justify-end gap-2">
            <Button
              onClick={() => void handleSubmit()}
              disabled={!collectionModal.name.trim() || providerSelectDisabled}
            >
              {collectionModal.mode === 'create-and-save' ? 'Create & Save' : 'Create'}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
