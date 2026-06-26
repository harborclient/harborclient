import {
  cloneDraft,
  createTab,
  normalizeDraft,
  syncDraftUrlWithParams,
  type RequestDraft,
  type RequestTab
} from '#/renderer/src/store/drafts';
import type { BodyType, HttpMethod, KeyValue } from '#/shared/types';

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
 * Returns whether a parsed value matches the KeyValue shape.
 *
 * @param value - Candidate key/value row from persisted storage.
 * @returns True when all required fields are present with correct types.
 */
function isKeyValue(value: unknown): value is KeyValue {
  return (
    isRecord(value) &&
    typeof value.key === 'string' &&
    typeof value.value === 'string' &&
    typeof value.enabled === 'boolean'
  );
}

/**
 * Returns whether a parsed value is an array of valid KeyValue rows.
 *
 * @param value - Candidate headers or params array from persisted storage.
 * @returns True when every entry is a valid KeyValue.
 */
function isKeyValueArray(value: unknown): value is KeyValue[] {
  return Array.isArray(value) && value.every(isKeyValue);
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
 * Returns whether a parsed value matches the RequestDraft shape required for restore.
 *
 * @param value - Candidate draft from persisted storage.
 * @returns True when required draft fields are present with valid types.
 */
function isRequestDraft(value: unknown): value is RequestDraft {
  if (!isRecord(value)) return false;
  if (
    typeof value.name !== 'string' ||
    typeof value.url !== 'string' ||
    typeof value.body !== 'string' ||
    !HTTP_METHODS.has(value.method as HttpMethod) ||
    !BODY_TYPES.has(value.body_type as BodyType) ||
    !isKeyValueArray(value.headers) ||
    !isKeyValueArray(value.params)
  ) {
    return false;
  }
  if (!isOptionalNumber(value.id)) return false;
  if (!isOptionalNumber(value.collection_id)) return false;
  if (!isOptionalFolderId(value.folder_id)) return false;
  if (value.pre_request_script !== undefined && typeof value.pre_request_script !== 'string') {
    return false;
  }
  if (value.post_request_script !== undefined && typeof value.post_request_script !== 'string') {
    return false;
  }
  if (value.comment !== undefined && typeof value.comment !== 'string') {
    return false;
  }
  return true;
}

/**
 * Returns whether a parsed value matches the persisted tab shape.
 *
 * @param value - Candidate tab entry from persisted storage.
 * @returns True when tabId and draft are valid; savedDraft is validated when present.
 */
function isPersistedTab(value: unknown): value is PersistedTab {
  if (!isRecord(value)) return false;
  if (typeof value.tabId !== 'string' || value.tabId.length === 0) return false;
  if (!isRequestDraft(value.draft)) return false;
  if (value.savedDraft !== undefined && !isRequestDraft(value.savedDraft)) return false;
  return true;
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
    if (!raw) return defaultTabState();

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.tabs)) return defaultTabState();

    const seenTabIds = new Set<string>();
    const tabs: RequestTab[] = [];
    for (const entry of parsed.tabs) {
      if (!isPersistedTab(entry) || seenTabIds.has(entry.tabId)) continue;
      seenTabIds.add(entry.tabId);
      tabs.push(persistedTabToRequestTab(entry));
    }

    if (tabs.length === 0) return defaultTabState();

    const activeTabId =
      typeof parsed.activeTabId === 'string' && tabs.some((tab) => tab.tabId === parsed.activeTabId)
        ? parsed.activeTabId
        : tabs[0].tabId;

    return { tabs, activeTabId };
  } catch {
    return defaultTabState();
  }
}

let initialTabState: { tabs: RequestTab[]; activeTabId: string } | undefined;

/**
 * Returns cached initial tab state, loading from storage on first call.
 */
export function getInitialTabState(): { tabs: RequestTab[]; activeTabId: string } {
  if (initialTabState === undefined) {
    initialTabState = loadTabsFromStorage();
  }
  return initialTabState;
}

/**
 * Persists open tabs to localStorage.
 *
 * Ignores quota, privacy-mode, and other storage failures so Redux subscribers
 * are not interrupted on every dispatch.
 */
export function persistTabs(tabs: RequestTab[], activeTabId: string): void {
  try {
    const payload: PersistedOpenTabs = {
      tabs: tabs.map((t) => ({ tabId: t.tabId, draft: t.draft, savedDraft: t.savedDraft })),
      activeTabId
    };
    localStorage.setItem(OPEN_TABS_KEY, JSON.stringify(payload));
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
