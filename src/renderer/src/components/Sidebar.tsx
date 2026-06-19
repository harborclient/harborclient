import { useState } from 'react'
import type { Collection, SavedRequest } from '#/shared/types'
import {
  METHOD_CLASSES,
  field,
  iconButton,
  iconButtonDanger,
  sourceRow,
  toolbarButton
} from '#/renderer/src/ui/classes'

interface Props {
  /**
   * All saved collections.
   */
  collections: Collection[]

  /**
   * Saved requests in the selected collection.
   */
  requests: SavedRequest[]

  /**
   * ID of the active collection, or null when none is selected.
   */
  selectedCollectionId: number | null

  /**
   * ID of the request loaded in the editor, if any.
   */
  activeRequestId?: number

  /**
   * Called when the user picks a collection.
   *
   * @param id - Selected collection ID.
   */
  onSelectCollection: (id: number) => void

  /**
   * Opens the new-collection modal.
   */
  onAddCollection: () => void

  /**
   * Persists a collection rename.
   *
   * @param id - Collection ID to rename.
   * @param name - New display name.
   */
  onRenameCollection: (id: number, name: string) => Promise<void>

  /**
   * Deletes a collection and its saved requests.
   *
   * @param id - Collection ID to delete.
   */
  onDeleteCollection: (id: number) => Promise<void>

  /**
   * Loads a saved request into the editor.
   *
   * @param req - Saved request to load.
   */
  onLoadRequest: (req: SavedRequest) => void

  /**
   * Deletes a saved request.
   *
   * @param id - Request ID to delete.
   */
  onDeleteRequest: (id: number) => Promise<void>

  /**
   * Resets the editor to a blank draft.
   */
  onNewRequest: () => void
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
  onRenameCollection,
  onDeleteCollection,
  onLoadRequest,
  onDeleteRequest,
  onNewRequest
}: Props) {
  const [editingCollectionId, setEditingCollectionId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  /**
   * Enters inline rename mode for a collection.
   *
   * @param collection - Collection to rename.
   */
  const startRename = (collection: Collection) => {
    setEditingCollectionId(collection.id)
    setEditingName(collection.name)
  }

  /** Commits the inline collection rename if the name is non-empty. */
  const commitRename = async () => {
    if (editingCollectionId && editingName.trim()) {
      await onRenameCollection(editingCollectionId, editingName.trim())
    }
    setEditingCollectionId(null)
    setEditingName('')
  }

  /**
   * Toggles collection disclosure and selects it.
   *
   * @param collectionId - Collection to expand or collapse.
   */
  const toggleCollection = (collectionId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(collectionId)) {
        next.delete(collectionId)
      } else {
        next.add(collectionId)
      }
      return next
    })
    onSelectCollection(collectionId)
  }

  const isExpanded = (collectionId: number) =>
    expandedIds.has(collectionId) || selectedCollectionId === collectionId

  return (
    <aside className="flex w-100 shrink-0 flex-col border-r border-separator bg-sidebar">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <h1 className="m-0 text-[13px] font-semibold text-text">Harbor Client</h1>
        <button className={toolbarButton} onClick={onNewRequest}>
          + New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        <div className="mb-1 flex items-center justify-between gap-2 ps-1">
          <h2 className="m-0 text-[11px] font-medium uppercase tracking-wide text-muted">
            Collections
          </h2>
          <button className={toolbarButton} onClick={onAddCollection}>
            + Collection
          </button>
        </div>

        <div className="flex flex-col gap-0.5">
          {collections.length === 0 && (
            <div className="px-2 py-1.5 text-[13px] text-muted">No collections yet</div>
          )}
          {collections.map((collection) => {
            const expanded = isExpanded(collection.id)
            const selected = selectedCollectionId === collection.id

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
                  {editingCollectionId === collection.id ? (
                    <input
                      className={`${field} min-w-0 flex-1`}
                      value={editingName}
                      autoFocus
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => void commitRename()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void commitRename()
                        if (e.key === 'Escape') setEditingCollectionId(null)
                      }}
                    />
                  ) : (
                    <button
                      className="min-w-0 flex-1 cursor-pointer truncate border-none bg-transparent py-0.5 text-left text-[13px] text-inherit app-no-drag"
                      onClick={() => toggleCollection(collection.id)}
                      onDoubleClick={() => startRename(collection)}
                    >
                      {collection.name}
                    </button>
                  )}
                  <button
                    className={iconButton}
                    title="Rename"
                    onClick={() => startRename(collection)}
                  >
                    ✎
                  </button>
                  <button
                    className={iconButtonDanger}
                    title="Delete collection"
                    onClick={() => {
                      if (confirm(`Delete collection "${collection.name}"?`)) {
                        void onDeleteCollection(collection.id)
                      }
                    }}
                  >
                    ×
                  </button>
                </div>

                {expanded && (
                  <div className="ml-4 flex flex-col gap-0.5 py-0.5">
                    {requests.length === 0 && (
                      <div className="px-2 py-1 text-[12px] text-muted">No saved requests</div>
                    )}
                    {requests.map((req) => (
                      <div
                        key={req.id}
                        className={sourceRow(activeRequestId === req.id)}
                      >
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
                        <button
                          className={iconButtonDanger}
                          title="Delete request"
                          onClick={() => {
                            if (confirm(`Delete request "${req.name}"?`)) {
                              void onDeleteRequest(req.id)
                            }
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
