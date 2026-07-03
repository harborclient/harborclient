import type {
  BodyType,
  HttpMethod,
  KeyValue,
  SavedRequest,
  ScriptRef,
  ScriptTestResult,
  SendResult,
  SettingsSection
} from '#/shared/types';
import { defaultAuth, normalizeAuth, type AuthConfig } from '#/shared/auth';
import { applyParamsToUrl } from '#/shared/queryParams';
import {
  mirrorLegacyScriptString,
  normalizeScriptRefs,
  resolveScriptRefs
} from '#/shared/scriptRefs';

/**
 * Editable request state in the UI before or during save.
 */
export interface RequestDraft {
  id?: number;
  collection_id?: number;
  folder_id?: number | null;
  name: string;
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  auth: AuthConfig;
  body: string;
  body_type: BodyType;
  pre_request_script: string;
  post_request_script: string;
  pre_request_scripts: ScriptRef[];
  post_request_scripts: ScriptRef[];
  comment: string;
}

/**
 * Open request tab with draft, response, and in-flight state.
 */
export interface RequestTab {
  tabId: string;
  draft: RequestDraft;
  savedDraft: RequestDraft;
  response: SendResult | null;
  sending: boolean;
  sendingRequestId: string | null;
  testResults: ScriptTestResult[];
}

/**
 * Reference to a configuration page shown inside a tab.
 */
export type PageRef =
  | { type: 'settings'; section: SettingsSection }
  | { type: 'plugins' }
  | { type: 'team-hubs' }
  | { type: 'sharing-keys' }
  | { type: 'plugin-view'; pluginId: string; viewId: string }
  | { type: 'collection'; id: number }
  | { type: 'environment'; id: number };

/**
 * Tab that hosts a settings, plugins, or other configuration page.
 */
export interface PageTab {
  tabId: string;
  kind: 'page';
  page: PageRef;
}

/**
 * Discriminated union of open request editor tabs.
 */
export type Tab = RequestTab | PageTab;

/**
 * Returns whether a tab hosts a configuration page rather than a request.
 *
 * @param tab - Open tab from the tab bar.
 * @returns True when the tab is a page tab.
 */
export function isPageTab(tab: Tab): tab is PageTab {
  return 'kind' in tab && tab.kind === 'page';
}

/**
 * Returns whether a tab hosts an HTTP request editor.
 *
 * @param tab - Open tab from the tab bar.
 * @returns True when the tab is a request tab (including legacy persisted tabs without kind).
 */
export function isRequestTab(tab: Tab): tab is RequestTab {
  return !isPageTab(tab);
}

/**
 * Narrows a tab to a request tab for callers that require request-only fields.
 *
 * @param tab - Tab to narrow.
 * @returns The same tab typed as RequestTab.
 * @throws When the tab is not a request tab.
 */
export function asRequestTab(tab: Tab | undefined): RequestTab {
  if (!tab || !isRequestTab(tab)) {
    throw new Error('Expected a request tab');
  }
  return tab;
}

/**
 * Returns a stable dedupe key for a page reference.
 *
 * @param page - Page identity to key.
 * @returns Stable string used to find an existing page tab.
 */
export function pageRefKey(page: PageRef): string {
  switch (page.type) {
    case 'settings':
      return 'settings';
    case 'plugins':
      return 'plugins';
    case 'team-hubs':
      return 'team-hubs';
    case 'sharing-keys':
      return 'sharing-keys';
    case 'plugin-view':
      return `plugin-view:${page.pluginId}:${page.viewId}`;
    case 'collection':
      return `collection:${page.id}`;
    case 'environment':
      return `environment:${page.id}`;
  }
}

/**
 * Returns whether two page references refer to the same tab identity.
 *
 * @param a - First page reference.
 * @param b - Second page reference.
 * @returns True when both references would share one tab.
 */
export function pageRefsEqual(a: PageRef, b: PageRef): boolean {
  return pageRefKey(a) === pageRefKey(b);
}

/**
 * Creates a new page tab for the given page reference.
 *
 * @param page - Page to show in the tab.
 * @returns New PageTab with a unique tabId.
 */
export function createPageTab(page: PageRef): PageTab {
  return {
    tabId: crypto.randomUUID(),
    kind: 'page',
    page
  };
}

/**
 * Returns an empty key-value row with enabled set to true.
 *
 * @returns Blank KeyValue entry for editors.
 */
export const emptyKeyValue = (): KeyValue => ({ key: '', value: '', enabled: true });

/**
 * Ensures each key-value row has string fields and a boolean enabled flag.
 *
 * @param rows - Raw header or param rows from storage or imports.
 * @returns Sanitized rows safe for KeyValueEditor rendering.
 */
export function normalizeKeyValueRows(rows: KeyValue[] | undefined | null): KeyValue[] {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [emptyKeyValue()];
  }

  return rows.map((row) => ({
    key: typeof row?.key === 'string' ? row.key : '',
    value: typeof row?.value === 'string' ? row.value : '',
    enabled: row?.enabled ?? true
  }));
}

/**
 * Ensures a draft has all required fields, including script defaults for legacy persisted tabs.
 *
 * @param draft - Partial or full draft from storage or the database.
 * @returns Draft with script fields guaranteed to be strings.
 */
export function normalizeDraft(draft: RequestDraft): RequestDraft {
  const preRequestScripts = resolveScriptRefs(
    draft.pre_request_scripts,
    draft.pre_request_script ?? ''
  );
  const postRequestScripts = resolveScriptRefs(
    draft.post_request_scripts,
    draft.post_request_script ?? ''
  );
  return {
    ...draft,
    headers: normalizeKeyValueRows(draft.headers),
    params: normalizeKeyValueRows(draft.params),
    pre_request_script: mirrorLegacyScriptString(preRequestScripts),
    post_request_script: mirrorLegacyScriptString(postRequestScripts),
    pre_request_scripts: preRequestScripts,
    post_request_scripts: postRequestScripts,
    comment: draft.comment ?? '',
    auth: normalizeAuth(draft.auth)
  };
}

/**
 * Returns a shallow copy of a draft with cloned header/param arrays.
 *
 * @param draft - Draft to clone.
 * @returns Independent copy safe to use as a saved baseline.
 */
export function cloneDraft(draft: RequestDraft): RequestDraft {
  const normalized = normalizeDraft(draft);
  return {
    ...normalized,
    headers: normalized.headers.map((h) => ({ ...h })),
    params: normalized.params.map((p) => ({ ...p })),
    pre_request_scripts: normalized.pre_request_scripts.map((script) => ({ ...script })),
    post_request_scripts: normalized.post_request_scripts.map((script) => ({ ...script })),
    auth: {
      ...normalized.auth,
      basic: { ...normalized.auth.basic },
      bearer: { ...normalized.auth.bearer },
      oauth2: { ...normalized.auth.oauth2 }
    }
  };
}

/**
 * Normalizes editable draft fields for dirty comparison, matching save filtering.
 *
 * @param draft - Draft to normalize.
 * @returns Stable JSON string of comparable fields.
 */
export function normalizeDraftForCompare(draft: RequestDraft): string {
  const payload = {
    name: draft.name,
    method: draft.method,
    url: draft.url,
    body: draft.body,
    body_type: draft.body_type,
    pre_request_script: draft.pre_request_script ?? '',
    post_request_script: draft.post_request_script ?? '',
    pre_request_scripts: normalizeScriptRefs(draft.pre_request_scripts),
    post_request_scripts: normalizeScriptRefs(draft.post_request_scripts),
    comment: draft.comment ?? '',
    auth: draft.auth,
    headers: draft.headers.filter((h) => h.key.trim() || h.value.trim()),
    params: draft.params.filter((p) => p.key.trim() || p.value.trim())
  };
  return JSON.stringify(payload);
}

/**
 * Returns whether a draft differs from its saved baseline.
 *
 * @param draft - Current editable draft.
 * @param savedDraft - Last known clean draft.
 * @returns True when the tab has unsaved changes.
 */
export function isDraftDirty(draft: RequestDraft, savedDraft: RequestDraft): boolean {
  return normalizeDraftForCompare(draft) !== normalizeDraftForCompare(savedDraft);
}

/**
 * Returns whether a tab has unsaved changes.
 *
 * @param tab - Open tab from the tab bar.
 * @returns True when a request tab draft differs from its saved baseline.
 */
export function isTabDirty(tab: Tab): boolean {
  if (!isRequestTab(tab)) {
    return false;
  }
  return isDraftDirty(tab.draft, tab.savedDraft);
}

/**
 * Returns all open request tabs that have unsaved changes.
 *
 * @param tabs - Open tabs from the tab bar.
 * @returns Request tabs whose draft differs from its saved baseline.
 */
export function getDirtyTabs(tabs: Tab[]): RequestTab[] {
  return tabs.filter(isRequestTab).filter(isTabDirty);
}

/**
 * Returns dirty open tabs belonging to a collection (root and all folders).
 *
 * @param tabs - Open tabs from the tab bar.
 * @param collectionId - Collection whose unsaved requests should be saved.
 * @returns Dirty request tabs whose draft belongs to the collection.
 */
export function getDirtyTabsInCollection(tabs: Tab[], collectionId: number): RequestTab[] {
  return getDirtyTabs(tabs).filter((tab) => tab.draft.collection_id === collectionId);
}

/**
 * Returns dirty open tabs belonging to a folder within a collection.
 *
 * @param tabs - Open tabs from the tab bar.
 * @param collectionId - Parent collection id.
 * @param folderId - Folder whose unsaved requests should be saved.
 * @returns Dirty request tabs whose draft belongs to the folder.
 */
export function getDirtyTabsInFolder(
  tabs: Tab[],
  collectionId: number,
  folderId: number
): RequestTab[] {
  return getDirtyTabs(tabs).filter(
    (tab) => tab.draft.collection_id === collectionId && (tab.draft.folder_id ?? null) === folderId
  );
}

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
  auth: defaultAuth(),
  body: '',
  body_type: 'none',
  pre_request_script: '',
  post_request_script: '',
  pre_request_scripts: [],
  post_request_scripts: [],
  comment: ''
});

/**
 * Creates a new open tab from a draft.
 *
 * @param draft - Initial draft for the tab.
 * @returns New RequestTab with a unique tabId.
 */
export function createTab(draft: RequestDraft = defaultDraft()): RequestTab {
  const initialDraft = cloneDraft(draft);
  return {
    tabId: crypto.randomUUID(),
    draft: initialDraft,
    savedDraft: cloneDraft(initialDraft),
    response: null,
    sending: false,
    sendingRequestId: null,
    testResults: []
  };
}

/**
 * Ensures the draft URL query string reflects enabled params rows, matching the editor.
 *
 * @param draft - Draft whose URL should include enabled query parameters.
 * @returns Draft with URL updated from the params table.
 */
export function syncDraftUrlWithParams(draft: RequestDraft): RequestDraft {
  return { ...draft, url: applyParamsToUrl(draft.url, draft.params) };
}

/**
 * Converts a saved request from the database into an editable draft.
 *
 * @param req - Saved request to load into the editor.
 * @returns RequestDraft populated from the saved request.
 */
export function draftFromSaved(req: SavedRequest): RequestDraft {
  const preRequestScripts = resolveScriptRefs(
    req.pre_request_scripts,
    req.pre_request_script ?? ''
  );
  const postRequestScripts = resolveScriptRefs(
    req.post_request_scripts,
    req.post_request_script ?? ''
  );
  return syncDraftUrlWithParams({
    id: req.id,
    collection_id: req.collection_id,
    folder_id: req.folder_id,
    name: req.name,
    method: req.method,
    url: req.url,
    headers: normalizeKeyValueRows(req.headers.length ? req.headers : [emptyKeyValue()]),
    params: normalizeKeyValueRows(req.params.length ? req.params : [emptyKeyValue()]),
    auth: normalizeAuth(req.auth),
    body: req.body,
    body_type: req.body_type,
    pre_request_script: mirrorLegacyScriptString(preRequestScripts),
    post_request_script: mirrorLegacyScriptString(postRequestScripts),
    pre_request_scripts: preRequestScripts,
    post_request_scripts: postRequestScripts,
    comment: req.comment ?? ''
  });
}
