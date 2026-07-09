import {
  cloneDraft,
  createTab,
  defaultDraft,
  isPageTab,
  isRequestTab,
  normalizeDraft,
  syncDraftUrlWithParams,
  type PageRef,
  type RequestDraft,
  type RequestTab,
  type Tab
} from '#/renderer/src/store/drafts';
import type { BodyType, HttpMethod, KeyValue, SettingsSection } from '#/shared/types';

/** When false, persistTabs is a no-op so the default startup tab does not clobber electron-store. */
let tabsHydrated = false;

export const OPEN_TABS_KEY = 'harborclient.openTabs';
export const LEGACY_OPEN_TABS_KEY = 'harbor-client.openTabs';
export const ACTIVE_ENVIRONMENT_KEY = 'harborclient.activeEnvironmentId';

/**
 * Persisted request tab shape (draft only, no response/sending).
 */
export interface PersistedRequestTab {
  tabId: string;
  draft: RequestDraft;
  savedDraft?: RequestDraft;
}

/**
 * Persisted page tab shape.
 */
export interface PersistedPageTab {
  tabId: string;
  kind: 'page';
  page: PageRef;
}

/**
 * Persisted tab entry — request tabs omit kind for backward compatibility.
 */
export type PersistedTab = PersistedRequestTab | PersistedPageTab;

export interface PersistedOpenTabs {
  tabs: PersistedTab[];
  activeTabId: string;
}

const HTTP_METHODS = new Set<HttpMethod>([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS'
]);

const BODY_TYPES = new Set<BodyType>(['none', 'json', 'text', 'multipart', 'urlencoded']);

const SETTINGS_SECTIONS = new Set<string>([
  'general',
  'syntax',
  'storage',
  'shortcuts',
  'proxy',
  'globals',
  'ai',
  'backup-restore'
]);

/**
 * Returns whether a value is a plain object (not null or an array).
 *
 * @param value - Candidate value from parsed JSON.
 * @returns True when the value is a non-null object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Normalizes a persisted key-value row, defaulting enabled to true when absent.
 *
 * @param value - Candidate key/value row from persisted storage.
 * @returns Normalized KeyValue or null when key/value types are invalid.
 */
function normalizeKeyValue(value: unknown): KeyValue | null {
  if (!isRecord(value)) return null;
  if (typeof value.key !== 'string' || typeof value.value !== 'string') return null;
  return {
    key: value.key,
    value: value.value,
    enabled: typeof value.enabled === 'boolean' ? value.enabled : true
  };
}

/**
 * Normalizes a persisted headers or params array, skipping invalid rows.
 *
 * @param value - Candidate array from persisted storage.
 * @returns Normalized KeyValue array or null when the value is not an array.
 */
function normalizeKeyValueArray(value: unknown): KeyValue[] | null {
  if (!Array.isArray(value)) return null;
  return value
    .map((entry) => normalizeKeyValue(entry))
    .filter((entry): entry is KeyValue => entry !== null);
}

/**
 * Returns whether an optional numeric id field is absent or a finite number.
 *
 * @param value - Candidate id field from persisted storage.
 * @returns True when the field is undefined or a number.
 */
function isOptionalNumber(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value));
}

/**
 * Returns whether an optional folder id is absent, null, or a finite number.
 *
 * @param value - Candidate folder_id field from persisted storage.
 * @returns True when the field is undefined, null, or a number.
 */
function isOptionalFolderId(value: unknown): boolean {
  return (
    value === undefined || value === null || (typeof value === 'number' && Number.isFinite(value))
  );
}

/**
 * Normalizes a persisted draft into a full RequestDraft, or null when required fields are missing.
 *
 * @param value - Candidate draft from persisted storage.
 * @returns Normalized draft ready for runtime use, or null when salvage is impossible.
 */
function normalizePersistedDraft(value: unknown): RequestDraft | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.name !== 'string' ||
    typeof value.url !== 'string' ||
    typeof value.body !== 'string' ||
    !HTTP_METHODS.has(value.method as HttpMethod) ||
    !BODY_TYPES.has(value.body_type as BodyType)
  ) {
    return null;
  }

  const headers = normalizeKeyValueArray(value.headers);
  const params = normalizeKeyValueArray(value.params);
  if (headers === null || params === null) return null;

  if (!isOptionalNumber(value.id)) return null;
  if (!isOptionalNumber(value.collection_id)) return null;
  if (!isOptionalFolderId(value.folder_id)) return null;
  if (value.pre_request_script !== undefined && typeof value.pre_request_script !== 'string') {
    return null;
  }
  if (value.post_request_script !== undefined && typeof value.post_request_script !== 'string') {
    return null;
  }
  if (value.pre_request_scripts !== undefined && !Array.isArray(value.pre_request_scripts)) {
    return null;
  }
  if (value.post_request_scripts !== undefined && !Array.isArray(value.post_request_scripts)) {
    return null;
  }
  if (value.comment !== undefined && typeof value.comment !== 'string') {
    return null;
  }
  if (value.tags !== undefined && typeof value.tags !== 'string') {
    return null;
  }

  return normalizeDraft({
    id: value.id as number | undefined,
    collection_id: value.collection_id as number | undefined,
    folder_id: value.folder_id as number | null | undefined,
    name: value.name,
    method: value.method as HttpMethod,
    url: value.url,
    headers,
    params,
    auth: value.auth,
    body: value.body,
    body_type: value.body_type as BodyType,
    pre_request_script:
      typeof value.pre_request_script === 'string' ? value.pre_request_script : '',
    post_request_script:
      typeof value.post_request_script === 'string' ? value.post_request_script : '',
    pre_request_scripts: Array.isArray(value.pre_request_scripts)
      ? (value.pre_request_scripts as RequestDraft['pre_request_scripts'])
      : [],
    post_request_scripts: Array.isArray(value.post_request_scripts)
      ? (value.post_request_scripts as RequestDraft['post_request_scripts'])
      : [],
    comment: typeof value.comment === 'string' ? value.comment : '',
    tags: typeof value.tags === 'string' ? value.tags : ''
  } as RequestDraft);
}

/**
 * Normalizes a persisted settings section identifier.
 *
 * @param value - Candidate section from persisted storage.
 * @returns Valid settings section or null when invalid.
 */
function normalizeSettingsSection(value: unknown): SettingsSection | null {
  if (typeof value !== 'string') {
    return null;
  }
  if (SETTINGS_SECTIONS.has(value)) {
    return value as SettingsSection;
  }
  if (value.startsWith('plugin:')) {
    return value as SettingsSection;
  }
  return null;
}

/**
 * Normalizes a persisted page reference.
 *
 * @param value - Candidate page object from persisted storage.
 * @returns Valid PageRef or null when salvage is impossible.
 */
function normalizePageRef(value: unknown): PageRef | null {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return null;
  }

  switch (value.type) {
    case 'settings': {
      if (value.section === 'snippets') {
        return { type: 'snippets' };
      }
      const section = normalizeSettingsSection(value.section ?? 'general');
      return section ? { type: 'settings', section } : null;
    }
    case 'snippets':
      return { type: 'snippets' };
    case 'plugins':
      return { type: 'plugins' };
    case 'themes':
      return { type: 'themes' };
    case 'cookies':
      return { type: 'cookies' };
    case 'team-hubs':
      return { type: 'team-hubs' };
    case 'team-hub-admin':
      if (typeof value.hubId !== 'string' || value.hubId.length === 0) {
        return null;
      }
      return {
        type: 'team-hub-admin',
        hubId: value.hubId,
        ...(typeof value.label === 'string' && value.label.trim().length > 0
          ? { label: value.label.trim() }
          : {})
      };
    case 'sharing-keys':
      return { type: 'sharing-keys' };
    case 'plugin-view':
      if (typeof value.pluginId !== 'string' || typeof value.viewId !== 'string') {
        return null;
      }
      return { type: 'plugin-view', pluginId: value.pluginId, viewId: value.viewId };
    case 'collection':
      if (typeof value.id !== 'number' || !Number.isFinite(value.id)) {
        return null;
      }
      return { type: 'collection', id: value.id };
    case 'environment':
      if (typeof value.id !== 'number' || !Number.isFinite(value.id)) {
        return null;
      }
      return { type: 'environment', id: value.id };
    case 'collection-runner': {
      if (typeof value.collectionId !== 'number' || !Number.isFinite(value.collectionId)) {
        return null;
      }
      const folderId =
        value.folderId == null
          ? null
          : typeof value.folderId === 'number' && Number.isFinite(value.folderId)
            ? value.folderId
            : null;
      const requestId =
        value.requestId == null
          ? null
          : typeof value.requestId === 'number' && Number.isFinite(value.requestId)
            ? value.requestId
            : null;
      return {
        type: 'collection-runner',
        collectionId: value.collectionId,
        folderId,
        requestId
      };
    }
    default:
      return null;
  }
}

/**
 * Salvages a persisted page tab entry.
 *
 * @param value - Candidate tab entry from persisted storage.
 * @returns Salvaged page tab or null when tabId or page cannot be recovered.
 */
function salvagePersistedPageTab(value: unknown): PersistedPageTab | null {
  if (!isRecord(value)) return null;
  if (value.kind !== 'page') return null;
  if (typeof value.tabId !== 'string' || value.tabId.length === 0) return null;

  const page = normalizePageRef(value.page);
  if (!page) return null;

  return { tabId: value.tabId, kind: 'page', page };
}

/**
 * Salvages a persisted request tab entry, falling back to draft when savedDraft is invalid.
 *
 * @param value - Candidate tab entry from persisted storage.
 * @returns Salvaged tab or null when tabId or draft cannot be recovered.
 */
function salvagePersistedRequestTab(value: unknown): PersistedRequestTab | null {
  if (!isRecord(value)) return null;
  if (typeof value.tabId !== 'string' || value.tabId.length === 0) return null;

  const draft = normalizePersistedDraft(value.draft);
  if (!draft) return null;

  const savedDraft =
    value.savedDraft !== undefined ? (normalizePersistedDraft(value.savedDraft) ?? draft) : draft;

  return { tabId: value.tabId, draft, savedDraft };
}

/**
 * Salvages a persisted tab entry as either a request or page tab.
 *
 * @param value - Candidate tab entry from persisted storage.
 * @returns Salvaged tab or null when the entry cannot be recovered.
 */
function salvagePersistedTab(value: unknown): PersistedTab | null {
  const pageTab = salvagePersistedPageTab(value);
  if (pageTab) {
    return pageTab;
  }
  return salvagePersistedRequestTab(value);
}

/**
 * Converts a validated persisted request tab into runtime RequestTab state.
 *
 * @param tab - Validated persisted request tab entry.
 * @returns RequestTab with normalized drafts and cleared runtime fields.
 */
function persistedRequestTabToRequestTab(tab: PersistedRequestTab): RequestTab {
  const draft = syncDraftUrlWithParams(normalizeDraft(tab.draft));
  const savedDraft = syncDraftUrlWithParams(normalizeDraft(tab.savedDraft ?? tab.draft));
  return {
    tabId: tab.tabId,
    draft,
    savedDraft: cloneDraft(savedDraft),
    response: null,
    sending: false,
    sendingRequestId: null,
    testResults: [],
    scriptLogs: [],
    executionEvents: []
  };
}

/**
 * Converts a validated persisted tab into runtime tab state.
 *
 * @param tab - Validated persisted tab entry.
 * @returns Runtime Tab for Redux state.
 */
function persistedTabToTab(tab: PersistedTab): Tab {
  if ('kind' in tab && tab.kind === 'page') {
    return { tabId: tab.tabId, kind: 'page', page: tab.page };
  }
  return persistedRequestTabToRequestTab(tab as PersistedRequestTab);
}

/**
 * Returns whether in-memory tab state matches the default blank single request tab.
 *
 * @param tabs - Open tabs currently in Redux.
 * @returns True when there is one untouched Untitled Request tab.
 */
function isDefaultSingleTabState(tabs: Tab[]): boolean {
  if (tabs.length !== 1 || !isRequestTab(tabs[0])) return false;
  const fallback = defaultDraft();
  const tab = tabs[0];
  return (
    tab.draft.name === fallback.name &&
    tab.draft.url === fallback.url &&
    tab.draft.method === fallback.method &&
    tab.draft.body === fallback.body &&
    tab.draft.body_type === fallback.body_type
  );
}

/**
 * Returns whether localStorage still holds a multi-tab payload from a failed restore.
 *
 * @returns True when clobbering with the default single tab should be skipped.
 */
function shouldSkipClobberingPersist(): boolean {
  try {
    const raw = localStorage.getItem(OPEN_TABS_KEY);
    if (!raw) return false;

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.tabs)) return false;

    return parsed.tabs.length > 1;
  } catch {
    return false;
  }
}

/**
 * Returns default tab state when nothing is persisted or restore fails.
 */
export function defaultTabState(): { tabs: Tab[]; activeTabId: string } {
  const tab = createTab();
  return { tabs: [tab], activeTabId: tab.tabId };
}

/**
 * Loads the persisted active environment ID from localStorage.
 */
export function loadActiveEnvironmentId(): number | null {
  try {
    const raw = localStorage.getItem(ACTIVE_ENVIRONMENT_KEY);
    if (!raw) return null;
    const id = Number(raw);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

/**
 * Parses a serialized open-tabs payload into runtime tab state.
 *
 * @param raw - JSON string from electron-store or localStorage.
 * @returns Restored tabs or a default single tab when the payload is invalid.
 */
export function parseOpenTabsFromRaw(raw: string): { tabs: Tab[]; activeTabId: string } {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.tabs)) {
      return defaultTabState();
    }

    const seenTabIds = new Set<string>();
    const tabs: Tab[] = [];
    for (const entry of parsed.tabs) {
      const salvaged = salvagePersistedTab(entry);
      if (!salvaged || seenTabIds.has(salvaged.tabId)) {
        continue;
      }
      seenTabIds.add(salvaged.tabId);
      try {
        tabs.push(persistedTabToTab(salvaged));
      } catch {
        // Skip tabs that fail conversion.
      }
    }

    if (tabs.length === 0) {
      if (parsed.tabs.length === 0) {
        return { tabs: [], activeTabId: '' };
      }
      return defaultTabState();
    }

    const activeTabId =
      typeof parsed.activeTabId === 'string' && tabs.some((tab) => tab.tabId === parsed.activeTabId)
        ? parsed.activeTabId
        : tabs[0].tabId;

    return { tabs, activeTabId };
  } catch {
    return defaultTabState();
  }
}

/**
 * Marks open tabs as hydrated so Redux subscribers may persist tab state.
 */
export function markTabsHydrated(): void {
  tabsHydrated = true;
}

/**
 * Resets the hydration gate for tests simulating a cold app start.
 */
export function resetTabsHydratedForTests(): void {
  tabsHydrated = false;
}

/**
 * Loads open tabs from localStorage, salvaging valid tabs when the payload is partially corrupt.
 *
 * Invalid tab entries are skipped rather than failing the entire restore. When no valid tabs
 * remain, or the top-level payload shape is invalid, returns a default single tab.
 */
export function loadTabsFromStorage(): { tabs: Tab[]; activeTabId: string } {
  try {
    let raw = localStorage.getItem(OPEN_TABS_KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_OPEN_TABS_KEY);
      if (raw) {
        localStorage.setItem(OPEN_TABS_KEY, raw);
      }
    }
    if (!raw) {
      return defaultTabState();
    }

    return parseOpenTabsFromRaw(raw);
  } catch {
    return defaultTabState();
  }
}

/**
 * Returns default tab state for tests that still call this helper.
 */
export function getInitialTabState(): { tabs: Tab[]; activeTabId: string } {
  return defaultTabState();
}

/**
 * Clears hydration and cached initial tab state for tests simulating a cold start.
 */
export function resetInitialTabStateForTests(): void {
  resetTabsHydratedForTests();
}

/**
 * Persists open tabs to electron-store (primary) and localStorage (mirror).
 *
 * Ignores quota, privacy-mode, and other storage failures so Redux subscribers
 * are not interrupted on every dispatch.
 */
export function persistTabs(tabs: Tab[], activeTabId: string): void {
  try {
    if (!tabsHydrated) {
      return;
    }

    if (isDefaultSingleTabState(tabs) && shouldSkipClobberingPersist()) {
      return;
    }

    const payload: PersistedOpenTabs = {
      tabs: tabs.map((tab) => {
        if (isPageTab(tab)) {
          return { tabId: tab.tabId, kind: 'page' as const, page: tab.page };
        }
        if (isRequestTab(tab)) {
          return { tabId: tab.tabId, draft: tab.draft, savedDraft: tab.savedDraft };
        }
        throw new Error('Unknown tab kind');
      }),
      activeTabId
    };
    const serialized = JSON.stringify(payload);
    localStorage.setItem(OPEN_TABS_KEY, serialized);
    void window.api.setOpenTabsPayload(serialized).catch(() => {});
  } catch {
    // Ignore quota or privacy-mode failures.
  }
}

/**
 * Persists the active environment ID to localStorage.
 *
 * Ignores quota, privacy-mode, and other storage failures so Redux subscribers
 * are not interrupted on every dispatch.
 */
export function persistActiveEnvironmentId(id: number | null): void {
  try {
    if (id == null) {
      localStorage.removeItem(ACTIVE_ENVIRONMENT_KEY);
    } else {
      localStorage.setItem(ACTIVE_ENVIRONMENT_KEY, String(id));
    }
  } catch {
    // Ignore quota or privacy-mode failures.
  }
}
