import { useEffect, useState, type JSX } from 'react';
import type { Collection, SavedRequest } from '#/shared/types';
import { RowActionsMenu } from '#/renderer/src/components/RowActionsMenu';
import { METHOD_CLASSES, sourceRow } from '#/renderer/src/ui/classes';

interface Props {
  /**
   * All saved collections.
   */
  collections: Collection[];

  /**
   * Saved requests keyed by collection ID.
   */
  requestsByCollection: Record<number, SavedRequest[]>;

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
   */
  onSelectCollection: (id: number) => void;

  /**
   * Ensures a collection's saved requests are loaded.
   */
  onExpandCollection: (id: number) => void;

  /**
   * Opens the collection settings view.
   */
  onConfigureCollection: (id: number) => void;

  /**
   * Deletes a collection and its saved requests.
   */
  onDeleteCollection: (id: number) => Promise<void>;

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
 * Collections list with expandable saved requests.
 */
export function Collections({
  collections,
  requestsByCollection,
  selectedCollectionId,
  activeRequestId,
  onSelectCollection,
  onExpandCollection,
  onConfigureCollection,
  onDeleteCollection,
  onExportCollection,
  onNewRequestInCollection,
  onLoadRequest,
  onDeleteRequest
}: Props): JSX.Element {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [prevSelectedId, setPrevSelectedId] = useState<number | null>(null);

  if (selectedCollectionId !== prevSelectedId) {
    setPrevSelectedId(selectedCollectionId);
    if (selectedCollectionId != null && !expandedIds.has(selectedCollectionId)) {
      const next = new Set(expandedIds);
      next.add(selectedCollectionId);
      setExpandedIds(next);
    }
  }

  useEffect(() => {
    if (selectedCollectionId == null) return;
    onExpandCollection(selectedCollectionId);
  }, [selectedCollectionId, onExpandCollection]);

  /**
   * Toggles a collection's disclosure without changing the selection.
   *
   * @param collectionId - Collection to expand or collapse.
   */
  const toggleCollection = (collectionId: number): void => {
    const willExpand = !expandedIds.has(collectionId);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (willExpand) {
        next.add(collectionId);
      } else {
        next.delete(collectionId);
      }
      return next;
    });
    if (willExpand) {
      onExpandCollection(collectionId);
    }
  };

  const isExpanded = (collectionId: number): boolean => expandedIds.has(collectionId);

  return (
    <div className="flex flex-col gap-0.5">
      {collections.length === 0 && (
        <div className="px-2 py-1.5 text-[13px] text-muted">No collections yet</div>
      )}
      {collections.map((collection) => {
        const expanded = isExpanded(collection.id);
        const selected = selectedCollectionId === collection.id;
        const collectionRequests = requestsByCollection[collection.id];
        const loaded = collectionRequests != null;

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
                onClick={() => onSelectCollection(collection.id)}
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
                {loaded && collectionRequests.length === 0 && (
                  <div className="px-2 py-1 text-[12px] text-muted">No saved requests</div>
                )}
                {(collectionRequests ?? []).map((req) => (
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
  );
}
