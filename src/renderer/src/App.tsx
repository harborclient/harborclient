import { useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { useAppStore } from '#/renderer/src/store'
import { Sidebar } from '#/renderer/src/components/Sidebar'
import { TabBar } from '#/renderer/src/components/TabBar'
import { RequestEditor } from '#/renderer/src/components/RequestEditor'
import { ResponseViewer } from '#/renderer/src/components/ResponseViewer'
import { TitleBar } from '#/renderer/src/components/TitleBar'
import { field, primaryButton, secondaryButton } from '#/renderer/src/ui/classes'

const isMac = window.platform === 'darwin'

/**
 * Root application layout: sidebar, request editor, and response viewer.
 */
export default function App() {
  const store = useAppStore()
  const [collectionModal, setCollectionModal] = useState<
    'create' | 'create-and-save' | null
  >(null)
  const [newCollectionName, setNewCollectionName] = useState('')
  const requests =
    store.selectedCollectionId != null
      ? store.requestsByCollection[store.selectedCollectionId] ?? []
      : []

  /**
   * Saves the current draft, prompting for a new collection when none exists.
   */
  const handleSave = async () => {
    if (store.selectedCollectionId == null) {
      setNewCollectionName('')
      setCollectionModal('create-and-save')
      return
    }
    try {
      await store.saveRequest()
      toast.success('Request saved')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save request')
    }
  }

  /**
   * Creates a collection, optionally saving the current draft into it.
   */
  const handleCollectionModalSubmit = async () => {
    const name = newCollectionName.trim()
    if (!name) return
    try {
      const collection = await store.createCollection(name)
      if (collectionModal === 'create-and-save') {
        await store.saveRequest(collection.id)
        toast.success('Request saved')
      }
      setCollectionModal(null)
      setNewCollectionName('')
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : collectionModal === 'create-and-save'
            ? 'Failed to save request'
            : 'Failed to create collection'
      )
    }
  }

  const closeCollectionModal = () => {
    setCollectionModal(null)
    setNewCollectionName('')
  }

  return (
    <div className={`flex h-screen flex-col ${isMac ? 'platform-darwin' : ''}`}>
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          collections={store.collections}
          requests={requests}
          selectedCollectionId={store.selectedCollectionId}
          activeRequestId={store.draft.id}
          onSelectCollection={store.setSelectedCollectionId}
          onAddCollection={() => {
            setNewCollectionName('')
            setCollectionModal('create')
          }}
          onRenameCollection={store.renameCollection}
          onDeleteCollection={store.deleteCollection}
          onLoadRequest={store.loadRequest}
          onDeleteRequest={store.deleteRequest}
          onNewRequest={store.newRequest}
        />

        <main className="flex min-w-0 flex-1 flex-col bg-surface">
          <TabBar
            tabs={store.tabs}
            activeTabId={store.activeTabId}
            onSelect={store.setActiveTab}
            onClose={store.closeTab}
            onNew={store.newRequest}
          />
          <RequestEditor
            key={store.activeTabId}
            draft={store.draft}
            onChange={store.setDraft}
            onSend={() => void store.sendRequest()}
            onSave={() => void handleSave()}
            sending={store.sending}
          />
          <ResponseViewer
            key={store.activeTabId}
            response={store.response}
            sending={store.sending}
          />
        </main>
      </div>

      {collectionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={closeCollectionModal}
        >
          <div
            className="w-80 rounded-lg border border-separator bg-surface p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="m-0 mb-1 text-[13px] font-semibold text-text">New collection</h2>
            {collectionModal === 'create-and-save' && (
              <p className="mb-3 text-[12px] text-muted">
                Create a collection to save this request into.
              </p>
            )}
            <input
              className={`${field} w-full ${collectionModal === 'create' ? 'mt-2' : ''}`}
              type="text"
              autoFocus
              placeholder="Collection name"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCollectionModalSubmit()
                if (e.key === 'Escape') closeCollectionModal()
              }}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button className={secondaryButton} onClick={closeCollectionModal}>
                Cancel
              </button>
              <button
                className={primaryButton}
                onClick={() => void handleCollectionModalSubmit()}
                disabled={!newCollectionName.trim()}
              >
                {collectionModal === 'create-and-save' ? 'Create & Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toaster
        position="bottom-center"
        containerStyle={{ bottom: 16 }}
        toastOptions={{
          duration: 2000,
          style: {
            background: 'var(--mac-control)',
            color: 'var(--mac-text)',
            border: '1px solid var(--mac-separator)',
            fontSize: '13px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }
        }}
      />
    </div>
  )
}
