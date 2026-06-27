import {
  cloneDraft,
  createTab,
  defaultDraft,
  normalizeDraft,
  syncDraftUrlWithParams,
  type RequestDraft,
  type RequestTab
} from '#/renderer/src/store/drafts';
import type { BodyType, HttpMethod, KeyValue } from '#/shared/types';

/** When false, persistTabs is a no-op so the default startup tab does not clobber electron-store. */
let tabsHydrated = false;

export const OPEN_TABS_KEY = 'harborclient.openTabs';
export const LEGACY_OPEN_TABS_KEY = 'harbor-client.openTabs';
export const ACTIVE_ENVIRONMENT_KEY = 'harborclient.activeEnvironmentId';

/**
 * Persisted tab shape (draft only, no response/sending).
 */
export interface PersistedTab {
  tabId: string;
  draft: RequestDraft;
  savedDraft?: RequestDraft;
}

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
  if (value.comment !== undefined && typeof value.comment !== 'string') {
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
    comment: typeof value.comment === 'string' ? value.comment : ''
  } as RequestDraft);
}

/**
 * Salvages a persisted tab entry, falling back to draft when savedDraft is invalid.
 *
 * @param value - Candidate tab entry from persisted storage.
 * @returns Salvaged tab or null when tabId or draft cannot be recovered.
 */
function salvagePersistedTab(value: unknown): PersistedTab | null {
  if (!isRecord(value)) return null;
  if (typeof value.tabId !== 'string' || value.tabId.length === 0) return null;

  const draft = normalizePersistedDraft(value.draft);
  if (!draft) return null;

  const savedDraft =
    value.savedDraft !== undefined ? (normalizePersistedDraft(value.savedDraft) ?? draft) : draft;

  return { tabId: value.tabId, draft, savedDraft };
}

/**
 * Converts a validated persisted tab into runtime RequestTab state.
 *
 * @param tab - Validated persisted tab entry.
 * @returns RequestTab with normalized drafts and cleared runtime fields.
 */
function persistedTabToRequestTab(tab: PersistedTab): RequestTab {
  const draft = syncDraftUrlWithParams(normalizeDraft(tab.draft));
  const savedDraft = syncDraftUrlWithParams(normalizeDraft(tab.savedDraft ?? tab.draft));
  return {
    tabId: tab.tabId,
    draft,
    savedDraft: cloneDraft(savedDraft),
    response: null,
    sending: false,
    sendingRequestId: null,
    testResults: []
  };
}

/**
 * Returns whether in-memory tab state matches the default blank single tab.
 *
 * @param tabs - Open tabs currently in Redux.
 * @returns True when there is one untouched Untitled Request tab.
 */
function isDefaultSingleTabState(tabs: RequestTab[]): boolean {
  if (tabs.length !== 1) return false;
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
export function defaultTabState(): { tabs: RequestTab[]; activeTabId: string } {
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
export function parseOpenTabsFromRaw(raw: string): { tabs: RequestTab[]; activeTabId: string } {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.tabs)) {
      return defaultTabState();
    }

    const seenTabIds = new Set<string>();
    const tabs: RequestTab[] = [];
    for (const entry of parsed.tabs) {
      const salvaged = salvagePersistedTab(entry);
      if (!salvaged || seenTabIds.has(salvaged.tabId)) {
        continue;
      }
      seenTabIds.add(salvaged.tabId);
      try {
        tabs.push(persistedTabToRequestTab(salvaged));
      } catch {
        // Skip tabs that fail conversion.
      }
    }

    if (tabs.length === 0) {
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
export function loadTabsFromStorage(): { tabs: RequestTab[]; activeTabId: string } {
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
export function getInitialTabState(): { tabs: RequestTab[]; activeTabId: string } {
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
export function persistTabs(tabs: RequestTab[], activeTabId: string): void {
  try {
    if (!tabsHydrated) {
      return;
    }

    if (isDefaultSingleTabState(tabs) && shouldSkipClobberingPersist()) {
      return;
    }

    const payload: PersistedOpenTabs = {
      tabs: tabs.map((t) => ({ tabId: t.tabId, draft: t.draft, savedDraft: t.savedDraft })),
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
