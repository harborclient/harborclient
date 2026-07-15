import { useCallback, useMemo, useState, type JSX, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import type { CollectionDocument } from '#/shared/types';
import {
  Button,
  FieldError,
  Input,
  Modal,
  ModalFooter,
  PromptModal
} from '@harborclient/sdk/components';
import { SegmentedTabs, SegmentedTabPanel, SegmentedTabsGroup } from '@harborclient/sdk/components';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectFoldersByCollection } from '#/renderer/src/store/selectors';
import {
  createEnvironment,
  createFolder,
  importEnvironment,
  newDocumentInCollection,
  newDocumentInFolder,
  renameDocument,
  renameFolder,
  requestLoadDocument
} from '#/renderer/src/store/thunks';
import { formatErrorMessage } from '#/renderer/src/ui/modals/dialogHelpers';
import {
  DEFAULT_DOCUMENT_NAME,
  SidebarModalsContext,
  ensureMarkdownFilename,
  type SidebarModalsContextValue
} from '#/renderer/src/ui/sidebars/CollectionSidebar/sidebarModalsContext';

interface FolderModalState {
  /**
   * Whether the modal creates a new folder or renames an existing one.
   */
  mode: 'create' | 'rename';

  /**
   * Owning collection id.
   */
  collectionId: number;

  /**
   * Folder id being renamed, when in rename mode.
   */
  folderId?: number;

  /**
   * Current filename input value.
   */
  name: string;

  /**
   * Inline submit error, or null when the form is valid.
   */
  error: string | null;
}

interface DocumentModalState {
  /**
   * Whether the modal creates a new document or renames an existing one.
   */
  mode: 'create' | 'rename';

  /**
   * Owning collection id.
   */
  collectionId: number;

  /**
   * Owning folder id, or null/undefined for the collection root.
   */
  folderId?: number | null;

  /**
   * Document id being renamed, when in rename mode.
   */
  documentId?: number;

  /**
   * Current filename input value.
   */
  name: string;

  /**
   * Inline submit error, or null when the form is valid.
   */
  error: string | null;
}

interface ProviderProps {
  /**
   * Sidebar subtree that can open create/rename modals.
   */
  children: ReactNode;
}

/**
 * Owns the folder, document, and environment create/rename modals and exposes
 * openers to the sidebar tree. Each modal manages its own form state and
 * dispatches the relevant thunk on submit.
 */
export function SidebarModalsProvider({ children }: ProviderProps): JSX.Element {
  const dispatch = useAppDispatch();
  const foldersByCollection = useAppSelector(selectFoldersByCollection);

  const [folderModal, setFolderModal] = useState<FolderModalState | null>(null);
  const [documentModal, setDocumentModal] = useState<DocumentModalState | null>(null);
  const [showEnvironmentModal, setShowEnvironmentModal] = useState(false);
  const [environmentModalTab, setEnvironmentModalTab] = useState<'create' | 'import'>('create');
  const [newEnvironmentName, setNewEnvironmentName] = useState('');
  const [environmentModalError, setEnvironmentModalError] = useState<string | null>(null);

  /**
   * Opens the create-folder modal for a collection.
   */
  const openNewFolder = useCallback((collectionId: number): void => {
    setFolderModal({ mode: 'create', collectionId, name: '', error: null });
  }, []);

  /**
   * Opens the rename-folder modal, seeding the current folder name.
   */
  const openRenameFolder = useCallback(
    (folderId: number, collectionId: number): void => {
      const folders = foldersByCollection[collectionId] ?? [];
      const folder = folders.find((item) => item.id === folderId);
      setFolderModal({
        mode: 'rename',
        collectionId,
        folderId,
        name: folder?.name ?? '',
        error: null
      });
    },
    [foldersByCollection]
  );

  /**
   * Opens the create-document modal at a collection root or inside a folder.
   */
  const openNewDocument = useCallback((collectionId: number, folderId?: number | null): void => {
    setDocumentModal({
      mode: 'create',
      collectionId,
      folderId: folderId ?? null,
      name: DEFAULT_DOCUMENT_NAME,
      error: null
    });
  }, []);

  /**
   * Opens the rename-document modal, seeding the current filename.
   */
  const openRenameDocument = useCallback((doc: CollectionDocument): void => {
    setDocumentModal({
      mode: 'rename',
      collectionId: doc.collection_id,
      folderId: doc.folder_id,
      documentId: doc.id,
      name: doc.name,
      error: null
    });
  }, []);

  /**
   * Opens the add-environment modal in its default create tab.
   */
  const openAddEnvironment = useCallback((): void => {
    setEnvironmentModalTab('create');
    setNewEnvironmentName('');
    setEnvironmentModalError(null);
    setShowEnvironmentModal(true);
  }, []);

  /**
   * Closes the folder create/rename modal.
   */
  const closeFolderModal = (): void => {
    setFolderModal(null);
  };

  /**
   * Closes the document create/rename modal.
   */
  const closeDocumentModal = (): void => {
    setDocumentModal(null);
  };

  /**
   * Closes the add-environment modal and clears its form state.
   */
  const closeEnvironmentModal = (): void => {
    setShowEnvironmentModal(false);
    setEnvironmentModalTab('create');
    setNewEnvironmentName('');
    setEnvironmentModalError(null);
  };

  /**
   * Creates or renames a folder from the modal form.
   */
  const handleFolderModalSubmit = async (): Promise<void> => {
    if (!folderModal) return;
    const name = folderModal.name.trim();
    if (!name) return;

    const { mode, collectionId, folderId } = folderModal;
    setFolderModal({ ...folderModal, error: null });
    try {
      if (mode === 'create') {
        await dispatch(createFolder({ collectionId, name })).unwrap();
        toast.success('Folder created');
      } else if (folderId != null) {
        await dispatch(renameFolder({ id: folderId, collectionId, name })).unwrap();
        toast.success('Folder renamed');
      }
      closeFolderModal();
    } catch (err) {
      setFolderModal({
        ...folderModal,
        error: formatErrorMessage(err, 'Failed to save folder')
      });
    }
  };

  /**
   * Creates or renames a markdown document from the modal form and opens it.
   */
  const handleDocumentModalSubmit = async (): Promise<void> => {
    if (!documentModal) return;
    const name = ensureMarkdownFilename(documentModal.name);
    if (!name) return;

    const { mode, collectionId, folderId, documentId } = documentModal;
    setDocumentModal({ ...documentModal, name, error: null });
    try {
      if (mode === 'create') {
        const saved =
          folderId != null
            ? await dispatch(
                newDocumentInFolder({ collectionId, folderId, name, content: '' })
              ).unwrap()
            : await dispatch(newDocumentInCollection({ collectionId, name, content: '' })).unwrap();
        toast.success('Document created');
        closeDocumentModal();
        void dispatch(requestLoadDocument({ doc: saved }));
      } else if (documentId != null) {
        const saved = await dispatch(
          renameDocument({ id: documentId, collectionId, name })
        ).unwrap();
        toast.success('Document renamed');
        closeDocumentModal();
        void dispatch(requestLoadDocument({ doc: saved }));
      }
    } catch (err) {
      setDocumentModal({
        ...documentModal,
        name,
        error: formatErrorMessage(err, 'Failed to save document')
      });
    }
  };

  /**
   * Creates an environment from the modal form.
   */
  const handleEnvironmentModalSubmit = async (): Promise<void> => {
    const name = newEnvironmentName.trim();
    if (!name) return;
    setEnvironmentModalError(null);
    try {
      await dispatch(createEnvironment(name)).unwrap();
      toast.success('Environment created');
      closeEnvironmentModal();
    } catch (err) {
      setEnvironmentModalError(formatErrorMessage(err, 'Failed to create environment'));
    }
  };

  /**
   * Imports an environment from a JSON export or dotenv file selected via a native dialog.
   */
  const handleEnvironmentImport = async (): Promise<void> => {
    setEnvironmentModalError(null);
    try {
      const environment = await dispatch(importEnvironment()).unwrap();
      if (!environment) return;
      toast.success('Environment imported');
      closeEnvironmentModal();
    } catch (err) {
      setEnvironmentModalError(formatErrorMessage(err, 'Failed to import environment'));
    }
  };

  const value = useMemo<SidebarModalsContextValue>(
    () => ({
      openNewFolder,
      openRenameFolder,
      openNewDocument,
      openRenameDocument,
      openAddEnvironment
    }),
    [openNewFolder, openRenameFolder, openNewDocument, openRenameDocument, openAddEnvironment]
  );

  return (
    <SidebarModalsContext.Provider value={value}>
      {children}

      {folderModal && (
        <PromptModal
          title={folderModal.mode === 'create' ? 'New folder' : 'Rename folder'}
          labelledBy="sidebar-folder-modal-title"
          label="Folder name"
          srOnlyLabel
          placeholder="Folder name"
          value={folderModal.name}
          onChange={(name: string) =>
            setFolderModal((current) => (current ? { ...current, name, error: null } : current))
          }
          onSubmit={() => void handleFolderModalSubmit()}
          onClose={closeFolderModal}
          submitLabel={folderModal.mode === 'create' ? 'Create' : 'Save'}
          error={folderModal.error}
        />
      )}

      {documentModal && (
        <PromptModal
          title={documentModal.mode === 'create' ? 'New markdown document' : 'Rename document'}
          labelledBy="sidebar-document-modal-title"
          label="Document filename"
          srOnlyLabel
          inputId="sidebar-document-name"
          placeholder="README.md"
          value={documentModal.name}
          onChange={(name: string) =>
            setDocumentModal((current) => (current ? { ...current, name, error: null } : current))
          }
          onSubmit={() => void handleDocumentModalSubmit()}
          onClose={closeDocumentModal}
          submitLabel={documentModal.mode === 'create' ? 'Create' : 'Save'}
          error={documentModal.error}
          canSubmit={(name: string) => Boolean(ensureMarkdownFilename(name))}
        />
      )}

      {showEnvironmentModal && (
        <Modal
          onClose={closeEnvironmentModal}
          className="w-132"
          labelledBy="sidebar-environment-modal-title"
          title="Add environment"
        >
          <SegmentedTabsGroup
            value={environmentModalTab}
            onChange={setEnvironmentModalTab}
            ariaLabel="Add environment options"
          >
            <div className="-mx-4 -mt-4 mb-4">
              <SegmentedTabs
                fullWidth
                editable={false}
                tabs={[
                  { value: 'create', label: 'Create new' },
                  { value: 'import', label: 'Import file' }
                ]}
              />
            </div>

            {environmentModalError && (
              <FieldError spacing="section" className="mb-3 mt-0">
                {environmentModalError}
              </FieldError>
            )}

            <SegmentedTabPanel value="create">
              <Input
                className="w-full"
                type="text"
                autoFocus
                placeholder="Environment name"
                value={newEnvironmentName}
                onChange={(e) => {
                  setNewEnvironmentName(e.target.value);
                  setEnvironmentModalError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleEnvironmentModalSubmit();
                }}
              />
              <ModalFooter spaced>
                <Button
                  onClick={() => void handleEnvironmentModalSubmit()}
                  disabled={!newEnvironmentName.trim()}
                >
                  Create
                </Button>
              </ModalFooter>
            </SegmentedTabPanel>

            <SegmentedTabPanel value="import">
              <p className="mb-4 text-muted">
                Choose a HarborClient environment export (.json) or a .env file to import variables.
              </p>
              <ModalFooter>
                <Button onClick={() => void handleEnvironmentImport()}>Import file</Button>
              </ModalFooter>
            </SegmentedTabPanel>
          </SegmentedTabsGroup>
        </Modal>
      )}
    </SidebarModalsContext.Provider>
  );
}
