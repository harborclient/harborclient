import { useState, type JSX } from 'react';
import type { Collection, SavedRequest } from '#/shared/types';
import { RowActionsMenu } from '#/renderer/src/components/RowActionsMenu';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { faPlus } from '#/renderer/src/fontawesome';
import { METHOD_CLASSES, sourceRow, toolbarButton } from './classes';

interface Props {
  /**
   * All saved collections.
   */
  collections: Collection[];

  /**
   * Saved requests in the selected collection.
   */
  requests: SavedRequest[];

  /**
   * ID of the active collection, or null when none is selected.
   */
  selectedCollectionId: number | null;

  /**
   * ID of the request loaded in the editor, if any.
   */
  activeRequestId?: number;

  /**
   * Called when the user picks a collection.
   *
   * @param id - Selected collection ID.
   */
  onSelectCollection: (id: number) => void;

  /**
   * Opens the new-collection modal.
   */
  onAddCollection: () => void;

  /**
   * Opens the collection settings view.
   *
   * @param id - Collection ID to configure.
   */
  onConfigureCollection: (id: number) => void;

  /**
   * Deletes a collection and its saved requests.
   *
   * @param id - Collection ID to delete.
   */
  onDeleteCollection: (id: number) => Promise<void>;

  /**
   * Exports a collection to a JSON file.
   *
   * @param id - Collection ID to export.
   */
  onExportCollection: (id: number) => Promise<void> | void;

  /**
   * Creates a new saved request in a collection.
   *
   * @param id - Collection ID to add the request to.
   */
  onNewRequestInCollection: (id: number) => Promise<void> | void;

  /**
   * Loads a saved request into the editor.
   *
   * @param req - Saved request to load.
   */
  onLoadRequest: (req: SavedRequest) => void;

  /**
   * Deletes a saved request.
   *
   * @param id - Request ID to delete.
   */
  onDeleteRequest: (id: number) => Promise<void>;
}

/**
 * Left sidebar: collection list, saved requests, and create/rename/delete actions.
 */
export function Sidebar({
  collections,
  requests,
  selectedCollectionId,
  activeRequestId,
  onSelectCollection,
  onAddCollection,
  onConfigureCollection,
  onDeleteCollection,
  onExportCollection,
  onNewRequestInCollection,
  onLoadRequest,
  onDeleteRequest
}: Props): JSX.Element {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  /**
   * Toggles collection disclosure and selects it.
   *
   * @param collectionId - Collection to expand or collapse.
   */
  const toggleCollection = (collectionId: number): void => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(collectionId)) {
        next.delete(collectionId);
      } else {
        next.add(collectionId);
      }
      return next;
    });
    onSelectCollection(collectionId);
  };

  const isExpanded = (collectionId: number): boolean =>
    expandedIds.has(collectionId) || selectedCollectionId === collectionId;

  return (
    <aside className="flex w-100 shrink-0 flex-col border-r border-separator bg-sidebar">
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        <div className="mb-1 flex items-center justify-between gap-2 ps-1">
          <h2 className="m-0 text-[11px] font-medium uppercase tracking-wide text-muted">
            Collections
          </h2>
          <button
            className={`${toolbarButton} inline-flex items-center gap-1`}
            onClick={onAddCollection}
          >
            <FaIcon icon={faPlus} className="h-3 w-3" />
            Collection
          </button>
        </div>

        <div className="flex flex-col gap-0.5">
          {collections.length === 0 && (
            <div className="px-2 py-1.5 text-[13px] text-muted">No collections yet</div>
          )}
          {collections.map((collection) => {
            const expanded = isExpanded(collection.id);
            const selected = selectedCollectionId === collection.id;

            return (
              <div key={collection.id}>
                <div className={sourceRow(selected)}>
                  <button
                    className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent p-0 text-[10px] text-muted hover:text-text app-no-drag"
                    onClick={() => toggleCollection(collection.id)}
                    aria-label={expanded ? 'Collapse' : 'Expand'}
                  >
                    {expanded ? '▼' : '▶'}
                  </button>
                  <button
                    className="min-w-0 flex-1 cursor-pointer truncate border-none bg-transparent py-0.5 text-left text-[13px] text-inherit app-no-drag"
                    onClick={() => toggleCollection(collection.id)}
                    onDoubleClick={() => onConfigureCollection(collection.id)}
                  >
                    {collection.name}
                  </button>
                  <RowActionsMenu
                    menuId={`collection-${collection.id}`}
                    openMenuId={openMenuId}
                    onOpenChange={setOpenMenuId}
                    items={[
                      { label: 'Settings', onSelect: () => onConfigureCollection(collection.id) },
                      {
                        label: 'New Request',
                        onSelect: () => void onNewRequestInCollection(collection.id)
                      },
                      {
                        label: 'Export',
                        onSelect: () => void onExportCollection(collection.id)
                      },
                      {
                        label: 'Delete',
                        variant: 'danger',
                        onSelect: () => {
                          if (confirm(`Delete collection "${collection.name}"?`)) {
                            void onDeleteCollection(collection.id);
                          }
                        }
                      }
                    ]}
                  />
                </div>

                {expanded && (
                  <div className="ml-4 flex flex-col gap-0.5 py-0.5">
                    {requests.length === 0 && (
                      <div className="px-2 py-1 text-[12px] text-muted">No saved requests</div>
                    )}
                    {requests.map((req) => (
                      <div key={req.id} className={sourceRow(activeRequestId === req.id)}>
                        <button
                          className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 border-none bg-transparent py-0.5 text-left text-inherit app-no-drag"
                          onClick={() => onLoadRequest(req)}
                        >
                          <span
                            className={`shrink-0 rounded px-1 py-px text-[10px] font-semibold ${METHOD_CLASSES[req.method.toLowerCase()] ?? 'bg-info text-white'}`}
                          >
                            {req.method}
                          </span>
                          <span className="truncate text-[13px]">{req.name}</span>
                        </button>
                        <RowActionsMenu
                          menuId={`request-${req.id}`}
                          openMenuId={openMenuId}
                          onOpenChange={setOpenMenuId}
                          items={[
                            {
                              label: 'Delete',
                              variant: 'danger',
                              onSelect: () => {
                                if (confirm(`Delete request "${req.name}"?`)) {
                                  void onDeleteRequest(req.id);
                                }
                              }
                            }
                          ]}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
