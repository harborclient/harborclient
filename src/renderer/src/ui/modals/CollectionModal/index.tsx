import { useCallback, type JSX } from 'react';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  closeCollectionModal,
  selectCollectionModal,
  setCollectionModalInviteTokenInput,
  setCollectionModalName,
  setCollectionModalTab
} from '#/renderer/src/store/slices/modalsSlice';
import {
  acceptInviteToken,
  createCollection,
  importCollection,
  saveRequest
} from '#/renderer/src/store/thunks';
import { SegmentedTabs } from '#/renderer/src/components/SegmentedTabs';
import { field, primaryButton, secondaryButton } from '#/renderer/src/ui/shared/classes';
import { Modal } from '#/renderer/src/ui/shared/Modal';

/**
 * Modal for creating a collection, importing from file, or accepting an invite.
 */
export function CollectionModal(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const collectionModal = useAppSelector(selectCollectionModal);

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
    try {
      const collection = await dispatch(createCollection(name)).unwrap();
      if (collectionModal.mode === 'create-and-save') {
        await dispatch(saveRequest(collection.id)).unwrap();
        toast.success('Request saved');
      }
      dispatch(closeCollectionModal());
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : collectionModal.mode === 'create-and-save'
            ? 'Failed to save request'
            : 'Failed to create collection'
      );
    }
  }, [collectionModal, dispatch]);

  /**
   * Imports a collection from a JSON file selected via a native dialog.
   */
  const handleImport = useCallback(async (): Promise<void> => {
    try {
      const collection = await dispatch(importCollection()).unwrap();
      if (!collection) return;
      toast.success('Collection imported');
      dispatch(closeCollectionModal());
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to import collection');
    }
  }, [dispatch]);

  /**
   * Accepts an invite JWT and adds the embedded database connection.
   */
  const handleAcceptInvite = useCallback(async (): Promise<void> => {
    if (!collectionModal) return;
    const token = collectionModal.inviteTokenInput.trim();
    if (!token) return;
    try {
      await dispatch(acceptInviteToken(token)).unwrap();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to accept invite');
    }
  }, [collectionModal, dispatch]);

  if (!collectionModal) return null;

  const showImportTab = collectionModal.mode === 'create';

  return (
    <Modal onClose={handleClose} className="w-[32rem]">
      <h2 className="m-0 mb-1 text-[13px] font-semibold text-text">
        {showImportTab ? 'Add collection' : 'New collection'}
      </h2>
      {collectionModal.mode === 'create-and-save' && (
        <p className="mb-3 text-[12px] text-muted">
          Create a collection to save this request into.
        </p>
      )}

      {showImportTab && (
        <SegmentedTabs
          value={collectionModal.tab}
          onChange={(tab) => dispatch(setCollectionModalTab(tab))}
          fullWidth
          className="mb-3"
          tabs={[
            { value: 'create', label: 'Create new' },
            { value: 'import', label: 'Import from file' },
            { value: 'invite', label: 'Accept invite' }
          ]}
        />
      )}

      {collectionModal.tab === 'invite' && showImportTab ? (
        <>
          <p className="mb-3 text-[12px] text-muted">
            Paste an invite token from a trusted sender. Add their public key under File →
            Certificates first. Restart HarborClient after accepting to load collections from that
            database.
          </p>
          <textarea
            className={`${field} min-h-28 w-full resize-y font-mono text-[12px]`}
            autoFocus
            placeholder="Paste invite token"
            value={collectionModal.inviteTokenInput}
            onChange={(e) => dispatch(setCollectionModalInviteTokenInput(e.target.value))}
          />
          <div className="mt-4 flex justify-end gap-2">
            <button className={secondaryButton} onClick={handleClose}>
              Cancel
            </button>
            <button
              className={primaryButton}
              onClick={() => void handleAcceptInvite()}
              disabled={!collectionModal.inviteTokenInput.trim()}
            >
              Accept
            </button>
          </div>
        </>
      ) : collectionModal.tab === 'create' || !showImportTab ? (
        <>
          <input
            className={`${field} w-full`}
            type="text"
            autoFocus
            placeholder="Collection name"
            value={collectionModal.name}
            onChange={(e) => dispatch(setCollectionModalName(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSubmit();
            }}
          />
          <div className="mt-4 flex justify-end gap-2">
            <button className={secondaryButton} onClick={handleClose}>
              Cancel
            </button>
            <button
              className={primaryButton}
              onClick={() => void handleSubmit()}
              disabled={!collectionModal.name.trim()}
            >
              {collectionModal.mode === 'create-and-save' ? 'Create & Save' : 'Create'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-4 text-[12px] text-muted">
            Choose a HarborClient or Postman collection export (.json) to import all saved requests.
          </p>
          <div className="flex justify-end gap-2">
            <button className={secondaryButton} onClick={handleClose}>
              Cancel
            </button>
            <button className={primaryButton} onClick={() => void handleImport()}>
              Import .json
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
