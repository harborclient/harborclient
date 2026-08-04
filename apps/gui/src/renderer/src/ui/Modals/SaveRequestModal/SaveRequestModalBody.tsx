import { useCallback, useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import { Button, Modal, ModalFooter } from '@harborclient/sdk/components';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import {
  closeSaveRequestModal,
  openCollectionModal
} from '#/renderer/src/store/slices/modalsSlice';
import { saveRequestToLocation } from '#/renderer/src/store/thunks/requests';
import { refreshCollectionContents } from '#/renderer/src/store/thunks/collections';
import { formatErrorMessage } from '#/renderer/src/ui/Modals/dialogHelpers';
import { Collections } from '#/renderer/src/ui/Sidebars/CollectionSidebar/Collections';
import { CollectionsHeaderActions } from '#/renderer/src/ui/Sidebars/CollectionSidebar/Collections/CollectionsHeaderActions';
import {
  CollectionsPickerContext,
  type CollectionsPickerContextValue,
  type CollectionsPickerSelection
} from '#/renderer/src/ui/Sidebars/CollectionSidebar/Collections/collectionsPickerContext';
import { SidebarSectionFilterProvider } from '#/renderer/src/ui/Sidebars/CollectionSidebar/filter/SidebarSectionFilterProvider';
import { SidebarMarkerPickerProvider } from '#/renderer/src/ui/Sidebars/CollectionSidebar/markers/SidebarMarkerPickerProvider';
import { SidebarProvidersProvider } from '#/renderer/src/ui/Sidebars/CollectionSidebar/providers/SidebarProvidersProvider';
import {
  SidebarSearchContext,
  type SidebarSearchContextValue
} from '#/renderer/src/ui/Sidebars/CollectionSidebar/search/sidebarSearchContext';
import { SidebarSelectionProvider } from '#/renderer/src/ui/Sidebars/CollectionSidebar/selection/SidebarSelectionProvider';

/**
 * Inactive search context for the save picker so Collections can render without
 * nesting SidebarSearchProvider (which mutates expansion / accordion keys).
 */
const INACTIVE_SEARCH_CONTEXT: SidebarSearchContextValue = {
  searchQuery: '',
  setSearchQuery: () => undefined,
  searchFilter: null,
  archivedSearchFilter: null,
  activeSearchFilter: null,
  searchActive: false,
  searchLoading: false,
  collapseSidebarTreesForMode: () => undefined
};

interface Props {
  /**
   * Request tab whose draft will be saved into the chosen location.
   */
  tabId: string;
}

/**
 * Save-request picker dialog body remounted per tab id so selection resets cleanly.
 *
 * @param tabId - Tab being saved.
 */
export function SaveRequestModalBody({ tabId }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const [selection, setSelection] = useState<CollectionsPickerSelection>({
    collectionId: null,
    folderId: null
  });
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /**
   * Closes the save-location picker without persisting.
   */
  const handleClose = useCallback((): void => {
    if (saving) {
      return;
    }
    dispatch(closeSaveRequestModal());
  }, [dispatch, saving]);

  /**
   * Opens the create-collection modal so the user can add a save target.
   */
  const handleCreateCollection = useCallback((): void => {
    dispatch(openCollectionModal({ mode: 'create' }));
  }, [dispatch]);

  /**
   * Selects a collection as the save target (folder cleared to root).
   *
   * @param collectionId - Collection the user clicked.
   */
  const handleSelectCollection = useCallback(
    (collectionId: number): void => {
      setSelection({ collectionId, folderId: null });
      void dispatch(refreshCollectionContents(collectionId));
    },
    [dispatch]
  );

  /**
   * Selects a folder within a collection as the save target.
   *
   * @param collectionId - Parent collection id.
   * @param folderId - Folder the user clicked.
   */
  const handleSelectFolder = useCallback((collectionId: number, folderId: number): void => {
    setSelection({ collectionId, folderId });
  }, []);

  /**
   * Picker context shared with the embedded Collections tree.
   */
  const pickerValue = useMemo<CollectionsPickerContextValue>(
    () => ({
      mode: 'save-target',
      selection,
      onSelectCollection: handleSelectCollection,
      onSelectFolder: handleSelectFolder
    }),
    [handleSelectCollection, handleSelectFolder, selection]
  );

  /**
   * Persists the request tab into the selected collection/folder and closes the modal.
   */
  const handleSave = useCallback(async (): Promise<void> => {
    if (selection.collectionId == null || saving) {
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      await dispatch(
        saveRequestToLocation({
          tabId,
          collectionId: selection.collectionId,
          folderId: selection.folderId
        })
      ).unwrap();
      toast.success('Request saved');
      dispatch(closeSaveRequestModal());
    } catch (err: unknown) {
      setSubmitError(formatErrorMessage(err, 'Failed to save request'));
    } finally {
      setSaving(false);
    }
  }, [dispatch, saving, selection.collectionId, selection.folderId, tabId]);

  const saveDisabled = selection.collectionId == null || saving;

  return (
    <Modal
      onClose={handleClose}
      title="Save request"
      labelledBy="save-request-modal-title"
      description="Choose a collection and optional folder for this request."
      className="w-[min(32rem,calc(100vw-2rem))]"
      closeDisabled={saving}
    >
      <div className="flex max-h-[min(60vh,480px)] min-h-[240px] flex-col overflow-hidden rounded-md border border-separator bg-surface">
        <SidebarProvidersProvider>
          <SidebarSearchContext.Provider value={INACTIVE_SEARCH_CONTEXT}>
            <SidebarMarkerPickerProvider>
              <SidebarSelectionProvider>
                <SidebarSectionFilterProvider>
                  <CollectionsPickerContext.Provider value={pickerValue}>
                    <div className="flex shrink-0 items-center gap-2 border-b border-separator px-2 py-1.5">
                      <span className="min-w-0 flex-1 truncate font-medium text-text">
                        Collections
                      </span>
                      <CollectionsHeaderActions />
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
                      <Collections />
                    </div>
                  </CollectionsPickerContext.Provider>
                </SidebarSectionFilterProvider>
              </SidebarSelectionProvider>
            </SidebarMarkerPickerProvider>
          </SidebarSearchContext.Provider>
        </SidebarProvidersProvider>
      </div>
      {submitError != null ? (
        <p className="mt-2 text-danger" role="alert">
          {submitError}
        </p>
      ) : null}
      <ModalFooter spaced>
        <Button
          type="button"
          variant="secondary"
          className="mr-auto"
          disabled={saving}
          onClick={handleCreateCollection}
        >
          Create collection
        </Button>
        <Button type="button" variant="secondary" onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={() => void handleSave()}
          disabled={saveDisabled}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
