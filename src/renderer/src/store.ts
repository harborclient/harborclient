import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  Collection,
  CollectionExportResult,
  KeyValue,
  SavedRequest,
  SendResult,
  Variable
} from '#/shared/types';
import {
  cloneDraft,
  createTab,
  defaultDraft,
  draftFromSaved,
  type RequestDraft,
  type RequestTab
} from '#/renderer/src/store/drafts';

const OPEN_TABS_KEY = 'harborclient.openTabs';
const LEGACY_OPEN_TABS_KEY = 'harbor-client.openTabs';

const VARIABLE_PATTERN = /\{\{\s*([\w.-]+)\s*\}\}/g;

/** A segment of text, optionally marking a {{variable}} token. */
export interface VariableToken {
  text: string;
  key?: string;
}

/**
 * Builds a lookup map from collection variables.
 *
 * @param variables - Collection-scoped variables.
 * @returns Map of trimmed keys to resolved values.
 */
function variableLookup(variables: Variable[]): Map<string, string> {
  return new Map(
    variables
      .filter((v) => v.key.trim())
      .map((v) => [v.key.trim(), v.value !== '' ? v.value : v.defaultValue])
  );
}

/**
 * Splits text into plain and {{variable}} segments.
 *
 * @param text - Text containing variable placeholders.
 * @returns Ordered tokens for rendering or further processing.
 */
export function tokenizeVariables(text: string): VariableToken[] {
  const tokens: VariableToken[] = [];
  const pattern = new RegExp(VARIABLE_PATTERN.source, 'g');
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      tokens.push({ text: text.slice(lastIndex, index) });
    }
    tokens.push({ text: match[0], key: match[1] });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    tokens.push({ text: text.slice(lastIndex) });
  }

  return tokens;
}

/**
 * Resolves a single variable key against collection variables.
 *
 * @param key - Variable name from a {{key}} placeholder.
 * @param variables - Collection-scoped variables.
 * @returns Resolved value, or undefined when the key is not defined.
 */
export function resolveVariable(key: string, variables: Variable[]): string | undefined {
  return variableLookup(variables).get(key);
}

/**
 * Replaces {{key}} placeholders in text with collection variable values.
 *
 * @param text - Text containing variable placeholders.
 * @param variables - Collection-scoped variables.
 * @returns Text with known variables substituted; unknown tokens are left unchanged.
 */
export function substituteVariables(text: string, variables: Variable[]): string {
  const lookup = variableLookup(variables);

  return text.replace(VARIABLE_PATTERN, (match, key: string) => {
    const value = lookup.get(key);
    return value !== undefined ? value : match;
  });
}

/** Persisted tab shape (draft only, no response/sending). */
interface PersistedTab {
  tabId: string;
  draft: RequestDraft;
  savedDraft?: RequestDraft;
}

interface PersistedOpenTabs {
  tabs: PersistedTab[];
  activeTabId: string;
}

/**
 * Returns default tab state when nothing is persisted or restore fails.
 *
 * @returns Initial tabs array and active tab ID.
 */
function defaultTabState(): { tabs: RequestTab[]; activeTabId: string } {
  const tab = createTab();
  return { tabs: [tab], activeTabId: tab.tabId };
}

/**
 * Loads open tabs from localStorage, or returns a default single tab.
 *
 * @returns Restored tab state with cleared responses and sending flags.
 */
function loadTabsFromStorage(): { tabs: RequestTab[]; activeTabId: string } {
  try {
    let raw = localStorage.getItem(OPEN_TABS_KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_OPEN_TABS_KEY);
      if (raw) {
        localStorage.setItem(OPEN_TABS_KEY, raw);
      }
    }
    if (!raw) return defaultTabState();

    const parsed = JSON.parse(raw) as PersistedOpenTabs;
    if (!parsed.tabs?.length || !parsed.activeTabId) return defaultTabState();

    const tabs: RequestTab[] = parsed.tabs.map((t) => {
      const draft = t.draft;
      const savedDraft = t.savedDraft ?? draft;
      return {
        tabId: t.tabId,
        draft,
        savedDraft: cloneDraft(savedDraft),
        response: null,
        sending: false
      };
    });

    const activeExists = tabs.some((t) => t.tabId === parsed.activeTabId);
    return {
      tabs,
      activeTabId: activeExists ? parsed.activeTabId : tabs[0].tabId
    };
  } catch {
    return defaultTabState();
  }
}

let initialTabState: { tabs: RequestTab[]; activeTabId: string } | undefined;

/**
 * Returns cached initial tab state, loading from storage on first call.
 *
 * @returns Tabs and active tab ID for useState lazy initializers.
 */
function getInitialTabState(): { tabs: RequestTab[]; activeTabId: string } {
  if (initialTabState === undefined) {
    initialTabState = loadTabsFromStorage();
  }
  return initialTabState;
}

/** A single entry in the global session console log. */
export interface ConsoleEntry {
  id: string;
  timestamp: number;
  requestName: string;
  collectionName?: string;
  result: SendResult;
}

/** State and actions exposed to renderer components via useAppStore. */
export interface AppStore {
  collections: Collection[];
  requestsByCollection: Record<number, SavedRequest[]>;
  selectedCollectionId: number | null;
  setSelectedCollectionId: (id: number | null) => void;
  tabs: RequestTab[];
  activeTabId: string;
  draft: RequestDraft;
  setDraft: (next: RequestDraft) => void;
  response: SendResult | null;
  sending: boolean;
  setActiveTab: (tabId: string) => void;
  closeTab: (tabId: string) => void;
  createCollection: (name: string) => Promise<Collection>;
  updateCollection: (
    id: number,
    name: string,
    variables: Variable[],
    headers: KeyValue[]
  ) => Promise<void>;
  deleteCollection: (id: number) => Promise<void>;
  exportCollection: (id: number) => Promise<CollectionExportResult>;
  importCollection: () => Promise<Collection | null>;
  saveRequest: (collectionId?: number) => Promise<SavedRequest>;
  deleteRequest: (id: number) => Promise<void>;
  loadRequest: (req: SavedRequest) => void;
  newRequest: () => void;
  newRequestInCollection: (collectionId: number) => Promise<SavedRequest>;
  sendRequest: () => Promise<void>;
  refreshRequests: (collectionId: number) => Promise<void>;
  consoleEntries: ConsoleEntry[];
  clearConsole: () => void;
}

/**
 * Central application state hook for collections, drafts, and HTTP requests.
 *
 * @returns Store state and actions for the renderer UI.
 */
export function useAppStore(): AppStore {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [requestsByCollection, setRequestsByCollection] = useState<Record<number, SavedRequest[]>>(
    {}
  );
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);
  const [tabs, setTabs] = useState<RequestTab[]>(() => getInitialTabState().tabs);
  const [activeTabId, setActiveTabId] = useState(() => getInitialTabState().activeTabId);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);

  const activeTab = useMemo(
    () => tabs.find((t) => t.tabId === activeTabId) ?? tabs[0],
    [tabs, activeTabId]
  );

  const draft = activeTab?.draft ?? defaultDraft();
  const response = activeTab?.response ?? null;
  const sending = activeTab?.sending ?? false;

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
      );
    },
    []
  );

  /**
   * Reloads collections from the main process and auto-selects the first if none selected.
   */
  const refreshCollections = useCallback(async (): Promise<void> => {
    const data = await window.api.listCollections();
    setCollections(data);
    if (data.length > 0 && !selectedCollectionId) {
      setSelectedCollectionId(data[0].id);
    }
  }, [selectedCollectionId]);

  /**
   * Reloads saved requests for a collection.
   *
   * @param collectionId - Collection whose requests to fetch.
   */
  const refreshRequests = useCallback(async (collectionId: number): Promise<void> => {
    const data = await window.api.listRequests(collectionId);
    setRequestsByCollection((prev) => ({ ...prev, [collectionId]: data }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    window.api.listCollections().then((data) => {
      if (cancelled) return;
      setCollections(data);
      if (data.length > 0 && !selectedCollectionId) {
        setSelectedCollectionId(data[0].id);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedCollectionId]);

  useEffect(() => {
    if (!selectedCollectionId) return;
    let cancelled = false;
    const collectionId = selectedCollectionId;
    window.api.listRequests(collectionId).then((data) => {
      if (cancelled) return;
      setRequestsByCollection((prev) => ({ ...prev, [collectionId]: data }));
    });
    return () => {
      cancelled = true;
    };
  }, [selectedCollectionId]);

  useEffect(() => {
    const payload: PersistedOpenTabs = {
      tabs: tabs.map((t) => ({ tabId: t.tabId, draft: t.draft, savedDraft: t.savedDraft })),
      activeTabId
    };
    localStorage.setItem(OPEN_TABS_KEY, JSON.stringify(payload));
  }, [tabs, activeTabId]);

  /**
   * Updates the active tab's draft.
   *
   * @param next - Updated request draft.
   */
  const setDraft = useCallback(
    (next: RequestDraft) => {
      if (!activeTab) return;
      updateTab(activeTab.tabId, () => ({ draft: next }));
    },
    [activeTab, updateTab]
  );

  /**
   * Activates an open tab by ID.
   *
   * @param tabId - Tab to select.
   */
  const setActiveTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  /**
   * Opens a new blank request tab and activates it.
   */
  const newRequest = useCallback(() => {
    const tab = createTab();
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.tabId);
  }, []);

  /**
   * Creates a saved request in a collection and opens it in a new tab.
   *
   * @param collectionId - Collection to add the request to.
   * @returns The newly saved request.
   */
  const newRequestInCollection = async (collectionId: number): Promise<SavedRequest> => {
    setSelectedCollectionId(collectionId);

    const saved = await window.api.saveRequest({
      collection_id: collectionId,
      name: 'Untitled Request',
      method: 'GET',
      url: '',
      headers: [],
      params: [],
      body: '',
      body_type: 'none'
    });

    const tab = createTab(draftFromSaved(saved));
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.tabId);
    await refreshRequests(collectionId);
    return saved;
  };

  /**
   * Closes a tab; keeps at least one tab open.
   *
   * @param tabId - Tab to close.
   */
  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      if (prev.length <= 1) {
        const tab = createTab();
        setActiveTabId(tab.tabId);
        return [tab];
      }

      const index = prev.findIndex((t) => t.tabId === tabId);
      if (index === -1) return prev;

      const next = prev.filter((t) => t.tabId !== tabId);
      setActiveTabId((currentActive) => {
        if (currentActive !== tabId) return currentActive;
        const neighbor = next[Math.min(index, next.length - 1)];
        return neighbor.tabId;
      });
      return next;
    });
  }, []);

  /**
   * Creates a collection and selects it.
   *
   * @param name - Display name for the new collection.
   * @returns The created collection.
   */
  const createCollection = async (name: string): Promise<Collection> => {
    const collection = await window.api.createCollection(name);
    await refreshCollections();
    setSelectedCollectionId(collection.id);
    return collection;
  };

  /**
   * Updates a collection's name, variables, and headers and refreshes the list.
   *
   * @param id - Collection ID to update.
   * @param name - New display name.
   * @param variables - Collection-scoped variables.
   * @param headers - Headers sent with every request in the collection.
   */
  const updateCollection = async (
    id: number,
    name: string,
    variables: Variable[],
    headers: KeyValue[]
  ): Promise<void> => {
    await window.api.updateCollection(id, name, variables, headers);
    await refreshCollections();
  };

  /**
   * Deletes a collection and clears selection if it was active.
   *
   * @param id - Collection ID to delete.
   */
  const deleteCollection = async (id: number): Promise<void> => {
    await window.api.deleteCollection(id);
    if (selectedCollectionId === id) {
      setSelectedCollectionId(null);
    }
    await refreshCollections();
  };

  /**
   * Exports a collection to a JSON file via a native save dialog.
   *
   * @param id - Collection ID to export.
   * @returns Whether the dialog was canceled and the saved path when written.
   */
  const exportCollection = async (id: number): Promise<CollectionExportResult> => {
    return window.api.exportCollection(id);
  };

  /**
   * Imports a collection from a JSON file and selects it.
   *
   * @returns The imported collection, or null when the dialog was canceled.
   */
  const importCollection = async (): Promise<Collection | null> => {
    const collection = await window.api.importCollection();
    if (!collection) return null;

    await refreshCollections();
    setSelectedCollectionId(collection.id);
    await refreshRequests(collection.id);
    return collection;
  };

  /**
   * Persists the active tab's draft to a collection.
   *
   * @param collectionId - Target collection; defaults to the selected collection.
   * @returns The saved request.
   * @throws When no collection is selected or provided.
   */
  const saveRequest = async (collectionId?: number): Promise<SavedRequest> => {
    if (!activeTab) throw new Error('No active tab');

    const targetId = collectionId ?? selectedCollectionId;
    if (targetId == null) {
      throw new Error('Select a collection first');
    }

    const { draft: currentDraft } = activeTab;
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
    });

    const savedDraft = cloneDraft(draftFromSaved(saved));
    updateTab(activeTab.tabId, () => ({ draft: savedDraft, savedDraft }));
    await refreshRequests(targetId);
    return saved;
  };

  /**
   * Deletes a saved request and closes any open tab showing it.
   *
   * @param id - Request ID to delete.
   */
  const deleteRequest = async (id: number): Promise<void> => {
    await window.api.deleteRequest(id);

    setTabs((prev) => {
      const matching = prev.filter((t) => t.draft.id === id);
      if (matching.length === 0) return prev;

      const remaining = prev.filter((t) => t.draft.id !== id);
      if (remaining.length === 0) {
        const tab = createTab();
        setActiveTabId(tab.tabId);
        return [tab];
      }

      const closedActive = matching.some((t) => t.tabId === activeTabId);
      if (closedActive) {
        const closedIndex = prev.findIndex((t) => t.tabId === activeTabId);
        const neighbor = remaining[Math.min(closedIndex, remaining.length - 1)];
        setActiveTabId(neighbor.tabId);
      }

      return remaining;
    });

    if (selectedCollectionId) {
      await refreshRequests(selectedCollectionId);
    }
  };

  /**
   * Opens a saved request in a new tab, or focuses an existing tab for it.
   *
   * @param req - Saved request to edit.
   */
  const loadRequest = useCallback((req: SavedRequest) => {
    setTabs((prev) => {
      const existing = prev.find((t) => t.draft.id === req.id);
      if (existing) {
        setActiveTabId(existing.tabId);
        return prev;
      }

      const tab = createTab(draftFromSaved(req));
      setActiveTabId(tab.tabId);
      return [...prev, tab];
    });
  }, []);

  /** Sends the active tab's draft as an HTTP request and stores the result on that tab. */
  const sendRequest = async (): Promise<void> => {
    if (!activeTab) return;

    const tabId = activeTab.tabId;
    const { draft: currentDraft } = activeTab;
    const collectionId = currentDraft.collection_id ?? selectedCollectionId;
    const collection = collectionId ? collections.find((c) => c.id === collectionId) : undefined;
    const resolvedUrl = collection
      ? substituteVariables(currentDraft.url, collection.variables)
      : currentDraft.url;
    const variables = collection?.variables ?? [];
    const collectionHeaders = collection
      ? (collection.headers ?? []).map((header) => ({
          ...header,
          value: substituteVariables(header.value, variables)
        }))
      : [];
    const draftHeaders = currentDraft.headers.map((header) => ({
      ...header,
      value: substituteVariables(header.value, variables)
    }));
    const headers = [...collectionHeaders, ...draftHeaders];
    const params = currentDraft.params.map((param) => ({
      ...param,
      value: substituteVariables(param.value, variables)
    }));
    const body = substituteVariables(currentDraft.body, variables);

    updateTab(tabId, () => ({ sending: true, response: null }));
    try {
      const result = await window.api.sendRequest({
        method: currentDraft.method,
        url: resolvedUrl,
        headers,
        params,
        body,
        bodyType: currentDraft.body_type
      });
      updateTab(tabId, () => ({ response: result }));
      setConsoleEntries((prev) => [
        {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          requestName: currentDraft.name,
          collectionName: collection?.name,
          result
        },
        ...prev
      ]);
    } finally {
      updateTab(tabId, () => ({ sending: false }));
    }
  };

  const clearConsole = useCallback(() => {
    setConsoleEntries([]);
  }, []);

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
    refreshRequests,
    consoleEntries,
    clearConsole
  };
}
