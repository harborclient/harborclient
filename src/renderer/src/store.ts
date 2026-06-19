import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  BodyType,
  Collection,
  HttpMethod,
  KeyValue,
  SavedRequest,
  SendResult
} from '#/shared/types'

const OPEN_TABS_KEY = 'harbor-client.openTabs'

/** Editable request state in the UI before or during save. */
export interface RequestDraft {
  id?: number
  collection_id?: number
  name: string
  method: HttpMethod
  url: string
  headers: KeyValue[]
  params: KeyValue[]
  body: string
  body_type: BodyType
}

/** Open request tab with draft, response, and in-flight state. */
export interface RequestTab {
  tabId: string
  draft: RequestDraft
  response: SendResult | null
  sending: boolean
}

/** Persisted tab shape (draft only, no response/sending). */
interface PersistedTab {
  tabId: string
  draft: RequestDraft
}

interface PersistedOpenTabs {
  tabs: PersistedTab[]
  activeTabId: string
}

/**
 * Returns an empty key-value row with enabled set to true.
 *
 * @returns Blank KeyValue entry for editors.
 */
export const emptyKeyValue = (): KeyValue => ({ key: '', value: '', enabled: true })

/**
 * Returns a new unsaved request draft with default values.
 *
 * @returns Default RequestDraft for a new request.
 */
export const defaultDraft = (): RequestDraft => ({
  name: 'Untitled Request',
  method: 'GET',
  url: '',
  headers: [emptyKeyValue()],
  params: [emptyKeyValue()],
  body: '',
  body_type: 'none'
})

/**
 * Creates a new open tab from a draft.
 *
 * @param draft - Initial draft for the tab.
 * @returns New RequestTab with a unique tabId.
 */
export function createTab(draft: RequestDraft = defaultDraft()): RequestTab {
  return {
    tabId: crypto.randomUUID(),
    draft,
    response: null,
    sending: false
  }
}

/**
 * Converts a saved request from the database into an editable draft.
 *
 * @param req - Saved request to load into the editor.
 * @returns RequestDraft populated from the saved request.
 */
export function draftFromSaved(req: SavedRequest): RequestDraft {
  return {
    id: req.id,
    collection_id: req.collection_id,
    name: req.name,
    method: req.method,
    url: req.url,
    headers: req.headers.length ? req.headers : [emptyKeyValue()],
    params: req.params.length ? req.params : [emptyKeyValue()],
    body: req.body,
    body_type: req.body_type
  }
}

/**
 * Returns default tab state when nothing is persisted or restore fails.
 *
 * @returns Initial tabs array and active tab ID.
 */
function defaultTabState(): { tabs: RequestTab[]; activeTabId: string } {
  const tab = createTab()
  return { tabs: [tab], activeTabId: tab.tabId }
}

/**
 * Loads open tabs from localStorage, or returns a default single tab.
 *
 * @returns Restored tab state with cleared responses and sending flags.
 */
function loadTabsFromStorage(): { tabs: RequestTab[]; activeTabId: string } {
  try {
    const raw = localStorage.getItem(OPEN_TABS_KEY)
    if (!raw) return defaultTabState()

    const parsed = JSON.parse(raw) as PersistedOpenTabs
    if (!parsed.tabs?.length || !parsed.activeTabId) return defaultTabState()

    const tabs: RequestTab[] = parsed.tabs.map((t) => ({
      tabId: t.tabId,
      draft: t.draft,
      response: null,
      sending: false
    }))

    const activeExists = tabs.some((t) => t.tabId === parsed.activeTabId)
    return {
      tabs,
      activeTabId: activeExists ? parsed.activeTabId : tabs[0].tabId
    }
  } catch {
    return defaultTabState()
  }
}

/**
 * Central application state hook for collections, drafts, and HTTP requests.
 *
 * @returns Store state and actions for the renderer UI.
 */
export function useAppStore() {
  const initial = loadTabsFromStorage()
  const [collections, setCollections] = useState<Collection[]>([])
  const [requestsByCollection, setRequestsByCollection] = useState<
    Record<number, SavedRequest[]>
  >({})
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null)
  const [tabs, setTabs] = useState<RequestTab[]>(initial.tabs)
  const [activeTabId, setActiveTabId] = useState(initial.activeTabId)

  const activeTab = useMemo(
    () => tabs.find((t) => t.tabId === activeTabId) ?? tabs[0],
    [tabs, activeTabId]
  )

  const draft = activeTab?.draft ?? defaultDraft()
  const response = activeTab?.response ?? null
  const sending = activeTab?.sending ?? false

  /**
   * Updates a single tab by ID.
   *
   * @param tabId - Tab to update.
   * @param updater - Function returning partial tab updates.
   */
  const updateTab = useCallback(
    (tabId: string, updater: (tab: RequestTab) => Partial<RequestTab>) => {
      setTabs((prev) =>
        prev.map((tab) => (tab.tabId === tabId ? { ...tab, ...updater(tab) } : tab))
      )
    },
    []
  )

  /**
   * Reloads collections from the main process and auto-selects the first if none selected.
   */
  const refreshCollections = useCallback(async () => {
    const data = await window.api.listCollections()
    setCollections(data)
    if (data.length > 0 && !selectedCollectionId) {
      setSelectedCollectionId(data[0].id)
    }
  }, [selectedCollectionId])

  /**
   * Reloads saved requests for a collection.
   *
   * @param collectionId - Collection whose requests to fetch.
   */
  const refreshRequests = useCallback(async (collectionId: number) => {
    const data = await window.api.listRequests(collectionId)
    setRequestsByCollection((prev) => ({ ...prev, [collectionId]: data }))
  }, [])

  useEffect(() => {
    void refreshCollections()
  }, [refreshCollections])

  useEffect(() => {
    if (selectedCollectionId) {
      void refreshRequests(selectedCollectionId)
    }
  }, [selectedCollectionId, refreshRequests])

  useEffect(() => {
    const payload: PersistedOpenTabs = {
      tabs: tabs.map((t) => ({ tabId: t.tabId, draft: t.draft })),
      activeTabId
    }
    localStorage.setItem(OPEN_TABS_KEY, JSON.stringify(payload))
  }, [tabs, activeTabId])

  /**
   * Updates the active tab's draft.
   *
   * @param next - Updated request draft.
   */
  const setDraft = useCallback(
    (next: RequestDraft) => {
      if (!activeTab) return
      updateTab(activeTab.tabId, () => ({ draft: next }))
    },
    [activeTab, updateTab]
  )

  /**
   * Activates an open tab by ID.
   *
   * @param tabId - Tab to select.
   */
  const setActiveTab = useCallback((tabId: string) => {
    setActiveTabId(tabId)
  }, [])

  /**
   * Opens a new blank request tab and activates it.
   */
  const newRequest = useCallback(() => {
    const tab = createTab()
    setTabs((prev) => [...prev, tab])
    setActiveTabId(tab.tabId)
  }, [])

  /**
   * Closes a tab; keeps at least one tab open.
   *
   * @param tabId - Tab to close.
   */
  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      if (prev.length <= 1) {
        const tab = createTab()
        setActiveTabId(tab.tabId)
        return [tab]
      }

      const index = prev.findIndex((t) => t.tabId === tabId)
      if (index === -1) return prev

      const next = prev.filter((t) => t.tabId !== tabId)
      setActiveTabId((currentActive) => {
        if (currentActive !== tabId) return currentActive
        const neighbor = next[Math.min(index, next.length - 1)]
        return neighbor.tabId
      })
      return next
    })
  }, [])

  /**
   * Creates a collection and selects it.
   *
   * @param name - Display name for the new collection.
   * @returns The created collection.
   */
  const createCollection = async (name: string) => {
    const collection = await window.api.createCollection(name)
    await refreshCollections()
    setSelectedCollectionId(collection.id)
    return collection
  }

  /**
   * Renames a collection and refreshes the list.
   *
   * @param id - Collection ID to rename.
   * @param name - New display name.
   */
  const renameCollection = async (id: number, name: string) => {
    await window.api.renameCollection(id, name)
    await refreshCollections()
  }

  /**
   * Deletes a collection and clears selection if it was active.
   *
   * @param id - Collection ID to delete.
   */
  const deleteCollection = async (id: number) => {
    await window.api.deleteCollection(id)
    if (selectedCollectionId === id) {
      setSelectedCollectionId(null)
    }
    await refreshCollections()
  }

  /**
   * Persists the active tab's draft to a collection.
   *
   * @param collectionId - Target collection; defaults to the selected collection.
   * @returns The saved request.
   * @throws When no collection is selected or provided.
   */
  const saveRequest = async (collectionId?: number) => {
    if (!activeTab) throw new Error('No active tab')

    const targetId = collectionId ?? selectedCollectionId
    if (targetId == null) {
      throw new Error('Select a collection first')
    }

    const { draft: currentDraft } = activeTab
    const saved = await window.api.saveRequest({
      id: currentDraft.id,
      collection_id: targetId,
      name: currentDraft.name,
      method: currentDraft.method,
      url: currentDraft.url,
      headers: currentDraft.headers.filter((h) => h.key.trim() || h.value.trim()),
      params: currentDraft.params.filter((p) => p.key.trim() || p.value.trim()),
      body: currentDraft.body,
      body_type: currentDraft.body_type
    })

    updateTab(activeTab.tabId, () => ({ draft: draftFromSaved(saved) }))
    await refreshRequests(targetId)
    return saved
  }

  /**
   * Deletes a saved request and closes any open tab showing it.
   *
   * @param id - Request ID to delete.
   */
  const deleteRequest = async (id: number) => {
    await window.api.deleteRequest(id)

    setTabs((prev) => {
      const matching = prev.filter((t) => t.draft.id === id)
      if (matching.length === 0) return prev

      const remaining = prev.filter((t) => t.draft.id !== id)
      if (remaining.length === 0) {
        const tab = createTab()
        setActiveTabId(tab.tabId)
        return [tab]
      }

      const closedActive = matching.some((t) => t.tabId === activeTabId)
      if (closedActive) {
        const closedIndex = prev.findIndex((t) => t.tabId === activeTabId)
        const neighbor = remaining[Math.min(closedIndex, remaining.length - 1)]
        setActiveTabId(neighbor.tabId)
      }

      return remaining
    })

    if (selectedCollectionId) {
      await refreshRequests(selectedCollectionId)
    }
  }

  /**
   * Opens a saved request in a new tab, or focuses an existing tab for it.
   *
   * @param req - Saved request to edit.
   */
  const loadRequest = useCallback((req: SavedRequest) => {
    setTabs((prev) => {
      const existing = prev.find((t) => t.draft.id === req.id)
      if (existing) {
        setActiveTabId(existing.tabId)
        return prev
      }

      const tab = createTab(draftFromSaved(req))
      setActiveTabId(tab.tabId)
      return [...prev, tab]
    })
  }, [])

  /** Sends the active tab's draft as an HTTP request and stores the result on that tab. */
  const sendRequest = async () => {
    if (!activeTab) return

    const tabId = activeTab.tabId
    const { draft: currentDraft } = activeTab

    updateTab(tabId, () => ({ sending: true, response: null }))
    try {
      const result = await window.api.sendRequest({
        method: currentDraft.method,
        url: currentDraft.url,
        headers: currentDraft.headers,
        params: currentDraft.params,
        body: currentDraft.body,
        bodyType: currentDraft.body_type
      })
      updateTab(tabId, () => ({ response: result }))
    } finally {
      updateTab(tabId, () => ({ sending: false }))
    }
  }

  return {
    collections,
    requestsByCollection,
    selectedCollectionId,
    setSelectedCollectionId,
    tabs,
    activeTabId,
    draft,
    setDraft,
    response,
    sending,
    setActiveTab,
    closeTab,
    createCollection,
    renameCollection,
    deleteCollection,
    saveRequest,
    deleteRequest,
    loadRequest,
    newRequest,
    sendRequest,
    refreshRequests
  }
}

/** Return type of useAppStore; state and actions exposed to components. */
export type AppStore = ReturnType<typeof useAppStore>
