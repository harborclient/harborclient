import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Collection, SavedRequest, Variable } from '#/shared/types'
import {
  cloneDraft,
  createTab,
  defaultDraft,
  draftFromSaved,
  type RequestDraft,
  type RequestTab
} from '#/renderer/src/store/drafts'

const OPEN_TABS_KEY = 'harbor-client.openTabs'

const VARIABLE_PATTERN = /\{\{\s*([\w.-]+)\s*\}\}/g

/**
 * Replaces {{key}} placeholders in text with collection variable values.
 *
 * @param text - Text containing variable placeholders.
 * @param variables - Collection-scoped variables.
 * @returns Text with known variables substituted; unknown tokens are left unchanged.
 */
function substituteVariables(text: string, variables: Variable[]): string {
  const lookup = new Map(
    variables.filter((v) => v.key.trim()).map((v) => [v.key.trim(), v.value])
  )

  return text.replace(VARIABLE_PATTERN, (match, key: string) => {
    const value = lookup.get(key)
    return value !== undefined ? value : match
  })
}

/** Persisted tab shape (draft only, no response/sending). */
interface PersistedTab {
  tabId: string
  draft: RequestDraft
  savedDraft?: RequestDraft
}

interface PersistedOpenTabs {
  tabs: PersistedTab[]
  activeTabId: string
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

    const tabs: RequestTab[] = parsed.tabs.map((t) => {
      const draft = t.draft
      const savedDraft = t.savedDraft ?? draft
      return {
        tabId: t.tabId,
        draft,
        savedDraft: cloneDraft(savedDraft),
        response: null,
        sending: false
      }
    })

    const activeExists = tabs.some((t) => t.tabId === parsed.activeTabId)
    return {
      tabs,
      activeTabId: activeExists ? parsed.activeTabId : tabs[0].tabId
    }
  } catch {
    return defaultTabState()
  }
}

let initialTabState: { tabs: RequestTab[]; activeTabId: string } | undefined

/**
 * Returns cached initial tab state, loading from storage on first call.
 *
 * @returns Tabs and active tab ID for useState lazy initializers.
 */
function getInitialTabState(): { tabs: RequestTab[]; activeTabId: string } {
  if (initialTabState === undefined) {
    initialTabState = loadTabsFromStorage()
  }
  return initialTabState
}

/**
 * Central application state hook for collections, drafts, and HTTP requests.
 *
 * @returns Store state and actions for the renderer UI.
 */
export function useAppStore() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [requestsByCollection, setRequestsByCollection] = useState<
    Record<number, SavedRequest[]>
  >({})
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null)
  const [tabs, setTabs] = useState<RequestTab[]>(() => getInitialTabState().tabs)
  const [activeTabId, setActiveTabId] = useState(() => getInitialTabState().activeTabId)

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
      tabs: tabs.map((t) => ({ tabId: t.tabId, draft: t.draft, savedDraft: t.savedDraft })),
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
   * Creates a saved request in a collection and opens it in a new tab.
   *
   * @param collectionId - Collection to add the request to.
   * @returns The newly saved request.
   */
  const newRequestInCollection = async (collectionId: number) => {
    setSelectedCollectionId(collectionId)

    const saved = await window.api.saveRequest({
      collection_id: collectionId,
      name: 'Untitled Request',
      method: 'GET',
      url: '',
      headers: [],
      params: [],
      body: '',
      body_type: 'none'
    })

    const tab = createTab(draftFromSaved(saved))
    setTabs((prev) => [...prev, tab])
    setActiveTabId(tab.tabId)
    await refreshRequests(collectionId)
    return saved
  }

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
   * Updates a collection's name and variables and refreshes the list.
   *
   * @param id - Collection ID to update.
   * @param name - New display name.
   * @param variables - Collection-scoped variables.
   */
  const updateCollection = async (id: number, name: string, variables: Variable[]) => {
    await window.api.updateCollection(id, name, variables)
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
   * Exports a collection to a JSON file via a native save dialog.
   *
   * @param id - Collection ID to export.
   * @returns Whether the dialog was canceled and the saved path when written.
   */
  const exportCollection = async (id: number) => {
    return window.api.exportCollection(id)
  }

  /**
   * Imports a collection from a JSON file and selects it.
   *
   * @returns The imported collection, or null when the dialog was canceled.
   */
  const importCollection = async () => {
    const collection = await window.api.importCollection()
    if (!collection) return null

    await refreshCollections()
    setSelectedCollectionId(collection.id)
    await refreshRequests(collection.id)
    return collection
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

    const savedDraft = cloneDraft(draftFromSaved(saved))
    updateTab(activeTab.tabId, () => ({ draft: savedDraft, savedDraft }))
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
    const collectionId = currentDraft.collection_id ?? selectedCollectionId
    const collection = collectionId
      ? collections.find((c) => c.id === collectionId)
      : undefined
    const resolvedUrl = collection
      ? substituteVariables(currentDraft.url, collection.variables)
      : currentDraft.url

    updateTab(tabId, () => ({ sending: true, response: null }))
    try {
      const result = await window.api.sendRequest({
        method: currentDraft.method,
        url: resolvedUrl,
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
    updateCollection,
    deleteCollection,
    exportCollection,
    importCollection,
    saveRequest,
    deleteRequest,
    loadRequest,
    newRequest,
    newRequestInCollection,
    sendRequest,
    refreshRequests
  }
}

/** Return type of useAppStore; state and actions exposed to components. */
export type AppStore = ReturnType<typeof useAppStore>
