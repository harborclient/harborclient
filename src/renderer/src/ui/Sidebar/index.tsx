import { useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { SavedRequest } from '#/shared/types';
import { ResizeHandle, useResizable } from '#/renderer/src/components/Resizable';
import { useStore } from '#/renderer/src/store/StoreContext';
import { field, primaryButton, secondaryButton } from '#/renderer/src/ui/shared/classes';
import { Collections } from './Collections';
import { Environments } from './Environments';
import { SidebarSection } from './SidebarSection';

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
  const store = useStore();
  const [collectionsExpanded, setCollectionsExpanded] = useState(true);
  const [environmentsExpanded, setEnvironmentsExpanded] = useState(true);
  const [showEnvironmentModal, setShowEnvironmentModal] = useState(false);
  const [newEnvironmentName, setNewEnvironmentName] = useState('');
  const { size: width, onResizeStart } = useResizable({
    axis: 'x',
    direction: 1,
    defaultSize: 400,
    minSize: 240,
    getMaxSize: () => 640,
    storageKey: 'hc.sidebarWidth'
  });

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
      await store.createEnvironment(name);
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
          <SidebarSection
            title="Collections"
            expanded={collectionsExpanded}
            onToggle={() => setCollectionsExpanded((open) => !open)}
            onAdd={onAddCollection}
            addLabel="Add Collection"
          >
            <Collections
              collections={store.collections}
              requestsByCollection={store.requestsByCollection}
              selectedCollectionId={store.selectedCollectionId}
              activeRequestId={store.draft.id}
              onSelectCollection={store.setSelectedCollectionId}
              onExpandCollection={store.refreshRequests}
              onConfigureCollection={onConfigureCollection}
              onDeleteCollection={store.deleteCollection}
              onExportCollection={async (id) => {
                const result = await store.exportCollection(id);
                if (!result.canceled) {
                  toast.success('Collection exported');
                }
              }}
              onNewRequestInCollection={async (id) => {
                try {
                  await store.newRequestInCollection(id);
                } catch (err) {
                  alert(err instanceof Error ? err.message : 'Failed to create request');
                }
              }}
              onLoadRequest={onLoadRequest}
              onDeleteRequest={store.deleteRequest}
            />
          </SidebarSection>

          <SidebarSection
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
              environments={store.environments}
              activeEnvironmentId={store.activeEnvironmentId}
              onSelectEnvironment={store.setActiveEnvironmentId}
              onConfigureEnvironment={onConfigureEnvironment}
              onDeleteEnvironment={store.deleteEnvironment}
            />
          </SidebarSection>
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
