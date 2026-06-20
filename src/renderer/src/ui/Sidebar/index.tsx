import { useState, type JSX } from 'react';
import type { Collection, Environment, SavedRequest } from '#/shared/types';
import { Collections } from './Collections';
import { Environments } from './Environments';
import { SidebarSection } from './SidebarSection';

interface Props {
  /**
   * All saved collections.
   */
  collections: Collection[];

  /**
   * All saved environments.
   */
  environments: Environment[];

  /**
   * Saved requests keyed by collection ID.
   */
  requestsByCollection: Record<number, SavedRequest[]>;

  /**
   * ID of the active collection, or null when none is selected.
   */
  selectedCollectionId: number | null;

  /**
   * ID of the active environment, or null when none is selected.
   */
  activeEnvironmentId: number | null;

  /**
   * ID of the request loaded in the editor, if any.
   */
  activeRequestId?: number;

  /**
   * Called when the user picks a collection.
   */
  onSelectCollection: (id: number) => void;

  /**
   * Called when the user picks an environment.
   */
  onSelectEnvironment: (id: number) => void;

  /**
   * Ensures a collection's saved requests are loaded.
   */
  onExpandCollection: (id: number) => void;

  /**
   * Opens the new-collection modal.
   */
  onAddCollection: () => void;

  /**
   * Opens the new-environment modal.
   */
  onAddEnvironment: () => void;

  /**
   * Opens the collection settings view.
   */
  onConfigureCollection: (id: number) => void;

  /**
   * Opens the environment settings view.
   */
  onConfigureEnvironment: (id: number) => void;

  /**
   * Deletes a collection and its saved requests.
   */
  onDeleteCollection: (id: number) => Promise<void>;

  /**
   * Deletes an environment.
   */
  onDeleteEnvironment: (id: number) => Promise<void>;

  /**
   * Exports a collection to a JSON file.
   */
  onExportCollection: (id: number) => Promise<void> | void;

  /**
   * Creates a new saved request in a collection.
   */
  onNewRequestInCollection: (id: number) => Promise<void> | void;

  /**
   * Loads a saved request into the editor.
   */
  onLoadRequest: (req: SavedRequest) => void;

  /**
   * Deletes a saved request.
   */
  onDeleteRequest: (id: number) => Promise<void>;
}

/**
 * Left sidebar with collapsible collections and environments sections.
 */
export function Sidebar({
  collections,
  environments,
  requestsByCollection,
  selectedCollectionId,
  activeEnvironmentId,
  activeRequestId,
  onSelectCollection,
  onSelectEnvironment,
  onExpandCollection,
  onAddCollection,
  onAddEnvironment,
  onConfigureCollection,
  onConfigureEnvironment,
  onDeleteCollection,
  onDeleteEnvironment,
  onExportCollection,
  onNewRequestInCollection,
  onLoadRequest,
  onDeleteRequest
}: Props): JSX.Element {
  const [collectionsExpanded, setCollectionsExpanded] = useState(true);
  const [environmentsExpanded, setEnvironmentsExpanded] = useState(true);

  return (
    <aside className="flex w-100 shrink-0 flex-col border-r border-separator bg-sidebar">
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        <SidebarSection
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
            activeRequestId={activeRequestId}
            onSelectCollection={onSelectCollection}
            onExpandCollection={onExpandCollection}
            onConfigureCollection={onConfigureCollection}
            onDeleteCollection={onDeleteCollection}
            onExportCollection={onExportCollection}
            onNewRequestInCollection={onNewRequestInCollection}
            onLoadRequest={onLoadRequest}
            onDeleteRequest={onDeleteRequest}
          />
        </SidebarSection>

        <SidebarSection
          title="Environments"
          expanded={environmentsExpanded}
          onToggle={() => setEnvironmentsExpanded((open) => !open)}
          onAdd={onAddEnvironment}
          addLabel="Add Environment"
        >
          <Environments
            environments={environments}
            activeEnvironmentId={activeEnvironmentId}
            onSelectEnvironment={onSelectEnvironment}
            onConfigureEnvironment={onConfigureEnvironment}
            onDeleteEnvironment={onDeleteEnvironment}
          />
        </SidebarSection>
      </div>
    </aside>
  );
}
