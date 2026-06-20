import { useEffect, useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { DatabaseConnection, SavedRequest } from '#/shared/types';
import { ResizeHandle, useResizable } from '#/renderer/src/components/Resizable';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActiveEnvironmentId,
  selectCollections,
  selectDraft,
  selectEnvironments,
  selectRequestsByCollection,
  selectSelectedCollectionId
} from '#/renderer/src/store/selectors';
import { setSelectedCollectionId } from '#/renderer/src/store/slices/collectionsSlice';
import { setActiveEnvironmentId } from '#/renderer/src/store/slices/environmentsSlice';
import {
  createEnvironment,
  deleteCollection,
  deleteEnvironment,
  deleteRequest,
  exportCollection,
  newRequestInCollection,
  refreshRequests
} from '#/renderer/src/store/thunks';
import { field, primaryButton, secondaryButton } from '#/renderer/src/ui/shared/classes';
import { Collections } from './Collections';
import { Environments } from './Environments';
import { Section } from './Section';

interface Props {
  /**
   * Opens the new-collection modal.
   */
  onAddCollection: () => void;

  /**
   * Opens the collection settings view.
   */
  onConfigureCollection: (id: number) => void;

  /**
   * Opens the environment settings view.
   */
  onConfigureEnvironment: (id: number) => void;

  /**
   * Loads a saved request into the editor.
   */
  onLoadRequest: (req: SavedRequest) => void;
}

/**
 * Left sidebar with collapsible collections and environments sections.
 */
export function Sidebar({
  onAddCollection,
  onConfigureCollection,
  onConfigureEnvironment,
  onLoadRequest
}: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const collections = useAppSelector(selectCollections);
  const requestsByCollection = useAppSelector(selectRequestsByCollection);
  const selectedCollectionId = useAppSelector(selectSelectedCollectionId);
  const draft = useAppSelector(selectDraft);
  const environments = useAppSelector(selectEnvironments);
  const activeEnvironmentId = useAppSelector(selectActiveEnvironmentId);

  const [collectionsExpanded, setCollectionsExpanded] = useState(true);
  const [environmentsExpanded, setEnvironmentsExpanded] = useState(true);
  const [showEnvironmentModal, setShowEnvironmentModal] = useState(false);
  const [newEnvironmentName, setNewEnvironmentName] = useState('');
  const [databaseConnections, setDatabaseConnections] = useState<DatabaseConnection[]>([]);
  const [primaryConnectionId, setPrimaryConnectionId] = useState('');
  const { size: width, onResizeStart } = useResizable({
    axis: 'x',
    direction: 1,
    defaultSize: 400,
    minSize: 240,
    getMaxSize: () => 640,
    storageKey: 'hc.sidebarWidth'
  });

  useEffect(() => {
    let cancelled = false;

    void Promise.all([window.api.listDatabaseConnections(), window.api.getActiveDatabaseId()]).then(
      ([connections, activeId]) => {
        if (cancelled) return;
        setDatabaseConnections(connections);
        setPrimaryConnectionId(activeId);
      }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  const connectionNamesById = useMemo(
    () =>
      Object.fromEntries(
        databaseConnections.map((connection) => [connection.id, connection.name || 'Untitled'])
      ),
    [databaseConnections]
  );

  const closeEnvironmentModal = (): void => {
    setShowEnvironmentModal(false);
    setNewEnvironmentName('');
  };

  /**
   * Creates an environment from the modal form.
   */
  const handleEnvironmentModalSubmit = async (): Promise<void> => {
    const name = newEnvironmentName.trim();
    if (!name) return;
    try {
      await dispatch(createEnvironment(name)).unwrap();
      toast.success('Environment created');
      closeEnvironmentModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create environment');
    }
  };

  return (
    <>
      <aside className="flex shrink-0 flex-col bg-sidebar" style={{ width }}>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          <Section
            title="Collections"
            expanded={collectionsExpanded}
            onToggle={() => setCollectionsExpanded((open) => !open)}
            onAdd={onAddCollection}
            addLabel="Add Collection"
          >
            <Collections
              collections={collections}
              requestsByCollection={requestsByCollection}
              selectedCollectionId={selectedCollectionId}
              primaryConnectionId={primaryConnectionId}
              connectionNamesById={connectionNamesById}
              activeRequestId={draft.id}
              onSelectCollection={(id) => dispatch(setSelectedCollectionId(id))}
              onExpandCollection={(id) => void dispatch(refreshRequests(id))}
              onConfigureCollection={onConfigureCollection}
              onDeleteCollection={async (id) => {
                await dispatch(deleteCollection(id));
              }}
              onExportCollection={async (id) => {
                const result = await dispatch(exportCollection(id)).unwrap();
                if (!result.canceled) {
                  toast.success('Collection exported');
                }
              }}
              onNewRequestInCollection={async (id) => {
                try {
                  await dispatch(newRequestInCollection(id)).unwrap();
                } catch (err) {
                  alert(err instanceof Error ? err.message : 'Failed to create request');
                }
              }}
              onLoadRequest={onLoadRequest}
              onDeleteRequest={async (id) => {
                await dispatch(deleteRequest(id));
              }}
            />
          </Section>

          <Section
            title="Environments"
            expanded={environmentsExpanded}
            onToggle={() => setEnvironmentsExpanded((open) => !open)}
            onAdd={() => {
              setNewEnvironmentName('');
              setShowEnvironmentModal(true);
            }}
            addLabel="Add Environment"
          >
            <Environments
              environments={environments}
              activeEnvironmentId={activeEnvironmentId}
              onSelectEnvironment={(id) => dispatch(setActiveEnvironmentId(id))}
              onConfigureEnvironment={onConfigureEnvironment}
              onDeleteEnvironment={async (id) => {
                await dispatch(deleteEnvironment(id));
              }}
            />
          </Section>
        </div>
      </aside>
      <ResizeHandle
        orientation="vertical"
        onResizeStart={onResizeStart}
        ariaLabel="Resize sidebar"
      />

      {showEnvironmentModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={closeEnvironmentModal}
        >
          <div
            className="w-96 rounded-lg border border-separator bg-surface p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="m-0 mb-1 text-[13px] font-semibold text-text">New environment</h2>
            <input
              className={`${field} mt-3 w-full`}
              type="text"
              autoFocus
              placeholder="Environment name"
              value={newEnvironmentName}
              onChange={(e) => setNewEnvironmentName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleEnvironmentModalSubmit();
                if (e.key === 'Escape') closeEnvironmentModal();
              }}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button className={secondaryButton} onClick={closeEnvironmentModal}>
                Cancel
              </button>
              <button
                className={primaryButton}
                onClick={() => void handleEnvironmentModalSubmit()}
                disabled={!newEnvironmentName.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
