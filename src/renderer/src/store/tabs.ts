import type {
  BodyType,
  CollectionDocument,
  HttpMethod,
  KeyValue,
  SavedRequest,
  ScriptRef,
  ScriptTestResult,
  ScriptExecutionEvent,
  SendResult,
  SettingsSection
} from '#/shared/types';
import { defaultAuth, normalizeAuth, type AuthConfig } from '#/shared/auth';
import { applyParamsToUrl } from '#/shared/queryParams';
import {
  mirrorLegacyScriptString,
  normalizeScriptRefsForCompare,
  resolveScriptRefs
} from '#/shared/scriptRefs';
import { normalizeRequestTags } from '#/shared/requestTags';

/**
 * Editable request state in the UI before or during save.
 */
export interface RequestDraft {
  /**
   * Persisted request id when editing an existing request; omitted for new drafts.
   */
  id?: number;

  /**
   * Collection that owns this request; may be unset until the draft is saved.
   */
  collection_id?: number;

  /**
   * Folder containing this request; null at collection root; may be unset until save.
   */
  folder_id?: number | null;

  /**
   * Display name shown in the tab bar and sidebar.
   */
  name: string;

  /**
   * HTTP method used for the request.
   */
  method: HttpMethod;

  /**
   * Request URL without query parameters.
   */
  url: string;

  /**
   * Request headers as editable key-value pairs.
   */
  headers: KeyValue[];

  /**
   * Query parameters as editable key-value pairs.
   */
  params: KeyValue[];

  /**
   * Authorization settings; none inherits collection auth at send time.
   */
  auth: AuthConfig;

  /**
   * Raw request body content.
   */
  body: string;

  /**
   * Content type of the request body.
   */
  body_type: BodyType;

  /**
   * Legacy single-script JavaScript run before the request is sent.
   */
  pre_request_script: string;

  /**
   * Legacy single-script JavaScript run after the response is received.
   */
  post_request_script: string;

  /**
   * Ordered pre-request scripts; canonical source when non-empty.
   */
  pre_request_scripts: ScriptRef[];

  /**
   * Ordered post-request scripts; canonical source when non-empty.
   */
  post_request_scripts: ScriptRef[];

  /**
   * Free-form notes for this request.
   */
  comment: string;

  /**
   * Comma-separated labels for organizing and searching requests.
   */
  tags: string;
}

/**
 * Open request tab with draft, response, and in-flight state.
 */
export interface RequestTab {
  /**
   * Stable client-side id for this open tab instance.
   */
  tabId: string;

  /**
   * Current editable request state in this tab.
   */
  draft: RequestDraft;

  /**
   * Last-saved request state used to detect unsaved changes.
   */
  savedDraft: RequestDraft;

  /**
   * Latest send result for this tab, or null when none has completed or it was cleared.
   */
  response: SendResult | null;

  /**
   * True while a send is in flight for this tab.
   */
  sending: boolean;

  /**
   * Correlator for the in-flight send, or null when idle.
   */
  sendingRequestId: string | null;

  /**
   * Assertion results from scripts for the latest completed send in this tab.
   */
  testResults: ScriptTestResult[];

  /**
   * Console output captured from scripts for the latest completed send in this tab.
   */
  scriptLogs: string[];

  /**
   * Ordered variable and flow-control activity from scripts for the latest completed send.
   */
  executionEvents: ScriptExecutionEvent[];

  /**
   * Aggregated script runtime errors for the latest completed send in this tab.
   */
  scriptError?: string;

  /**
   * Next request name from hc.execution.setNextRequest for collection runner flow control.
   */
  scriptNextRequest?: string | null;

  /**
   * When true, hc.execution.skipRequest() skipped the latest send in this tab.
   */
  scriptSkipRequest?: boolean;
}

/**
 * Plugin or theme management kind stored on plugin detail tabs.
 */
export type PluginDetailPageKind = 'plugins' | 'themes';

/**
 * Whether a plugin detail tab shows an installed row or a marketplace listing.
 */
export type PluginDetailPageSource = 'installed' | 'catalog';

/**
 * Snippet edit tab mode for create, edit, clone, or import flows.
 */
export type SnippetEditTabMode = 'new' | 'edit' | 'clone' | 'import';

/**
 * Reference to a configuration page shown inside a tab.
 */
export type PageRef =
  | { type: 'getting-started' }
  | {
      type: 'settings';
      section: SettingsSection;
      focusVariableKey?: string;
      focusSettingId?: string;
    }
  | { type: 'plugins' }
  | { type: 'themes' }
  | { type: 'snippets' }
  | { type: 'cookies' }
  | { type: 'team-hubs' }
  | { type: 'team-hub-admin'; hubId: string; label?: string }
  | { type: 'sharing-keys' }
  | { type: 'hosted-main-view'; pluginId: string; viewId: string }
  | { type: 'collection'; id: number; focusVariableKey?: string; focusSection?: string }
  | { type: 'folder'; collectionId: number; id: number; focusVariableKey?: string }
  | { type: 'environment'; id: number; focusVariableKey?: string }
  | {
      type: 'collection-runner';
      collectionId: number;
      folderId?: number | null;
      requestId?: number | null;
      requestIds?: number[] | null;
    }
  | {
      type: 'plugin-detail';
      kind: PluginDetailPageKind;
      source: PluginDetailPageSource;
      id: string;
      label: string;
    }
  | { type: 'snippet-detail'; catalogId: string; label: string }
  | {
      type: 'snippet-edit';
      mode: SnippetEditTabMode;
      snippetId?: number;
      readOnly?: boolean;
      seedCode?: string;
      label: string;
    }
  | {
      type: 'script-editor';
      requestTabId: string;
      phase: 'pre' | 'post';
      scriptId: string;
      label: string;
    }
  | {
      type: 'merge-editor';
      connectionId: string;
      filePath: string;
      label: string;
    };

/**
 * Tab that hosts a settings, plugins, or other configuration page.
 */
export interface PageTab {
  /**
   * Stable client-side id for this open tab instance.
   */
  tabId: string;

  /**
   * Discriminator that marks this tab as a configuration page.
   */
  kind: 'page';

  /**
   * Which configuration page this tab displays.
   */
  page: PageRef;
}

/**
 * Open markdown document tab with editable content and a saved baseline.
 */
export interface MarkdownTab {
  /**
   * Stable client-side id for this open tab instance.
   */
  tabId: string;

  /**
   * Discriminator that marks this tab as a markdown document editor.
   */
  kind: 'markdown';

  /**
   * Database id of the collection document being edited.
   */
  docId: number;

  /**
   * Collection that owns the document.
   */
  collectionId: number;

  /**
   * Folder containing the document; null when it lives at the collection root.
   */
  folderId: number | null;

  /**
   * Display file name shown in the tab bar and sidebar.
   */
  name: string;

  /**
   * Current editable markdown body in the editor.
   */
  content: string;

  /**
   * Last-saved markdown body used to detect unsaved changes.
   */
  savedContent: string;
}

/**
 * Discriminated union of open request editor tabs.
 */
export type Tab = RequestTab | PageTab | MarkdownTab;

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
 * Returns whether a tab hosts a collection markdown document editor.
 *
 * @param tab - Open tab from the tab bar.
 * @returns True when the tab is a markdown document tab.
 */
export function isMarkdownTab(tab: Tab): tab is MarkdownTab {
  return 'kind' in tab && tab.kind === 'markdown';
}

/**
 * Returns whether a tab hosts an HTTP request editor.
 *
 * @param tab - Open tab from the tab bar.
 * @returns True when the tab is a request tab (including legacy persisted tabs without kind).
 */
export function isRequestTab(tab: Tab): tab is RequestTab {
  return !isPageTab(tab) && !isMarkdownTab(tab);
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
    case 'getting-started':
      return 'getting-started';
    case 'settings':
      return 'settings';
    case 'plugins':
      return 'plugins';
    case 'themes':
      return 'themes';
    case 'snippets':
      return 'snippets';
    case 'cookies':
      return 'cookies';
    case 'team-hubs':
      return 'team-hubs';
    case 'team-hub-admin':
      return `team-hub-admin:${page.hubId}`;
    case 'sharing-keys':
      return 'sharing-keys';
    case 'hosted-main-view':
      return `hosted-main-view:${page.pluginId}:${page.viewId}`;
    case 'collection':
      return `collection:${page.id}`;
    case 'folder':
      return `folder:${page.id}`;
    case 'environment':
      return `environment:${page.id}`;
    case 'collection-runner':
      return 'collection-runner';
    case 'plugin-detail':
      return `plugin-detail:${page.kind}:${page.source}:${page.id}`;
    case 'snippet-detail':
      return `snippet-detail:${page.catalogId}`;
    case 'snippet-edit':
      return `snippet-edit:${page.snippetId ?? page.mode}`;
    case 'script-editor':
      return `script-editor:${page.requestTabId}:${page.phase}:${page.scriptId}`;
    case 'merge-editor':
      return `merge-editor:${page.connectionId}:${page.filePath}`;
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
    tags: normalizeRequestTags(draft.tags ?? ''),
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
    pre_request_scripts: normalizeScriptRefsForCompare(draft.pre_request_scripts),
    post_request_scripts: normalizeScriptRefsForCompare(draft.post_request_scripts),
    comment: draft.comment ?? '',
    tags: normalizeRequestTags(draft.tags ?? ''),
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
 * Creates a new markdown document tab from a saved collection document.
 *
 * @param doc - Saved document to open in the editor.
 * @returns New MarkdownTab with a unique tabId.
 */
export function createMarkdownTab(doc: CollectionDocument): MarkdownTab {
  return {
    tabId: crypto.randomUUID(),
    kind: 'markdown',
    docId: doc.id,
    collectionId: doc.collection_id,
    folderId: doc.folder_id,
    name: doc.name,
    content: doc.content,
    savedContent: doc.content
  };
}

/**
 * Returns whether a tab has unsaved changes.
 *
 * @param tab - Open tab from the tab bar.
 * @returns True when a request or markdown tab differs from its saved baseline.
 */
export function isTabDirty(tab: Tab): boolean {
  if (isMarkdownTab(tab)) {
    return tab.content !== tab.savedContent;
  }
  if (!isRequestTab(tab)) {
    return false;
  }
  return isDraftDirty(tab.draft, tab.savedDraft);
}

/**
 * Aligns an open markdown tab's editor state with on-disk document content.
 *
 * Heals three cases that leave the tab falsely amber (or stale) while Git is clean:
 * - Editor drift: disk matches the last-saved baseline, but in-memory content drifted
 *   (for example MDXEditor re-normalization after save).
 * - Missed baseline: disk matches the current editor body, but `savedContent` was not updated.
 * - External update: the tab is clean, but disk changed (pull, CLI, another process).
 *
 * Leaves real local edits alone when disk differs from both `content` and `savedContent`.
 *
 * @param tab - Open markdown tab to reconcile.
 * @param doc - Latest document loaded from storage for the same `docId`.
 * @returns Updated content fields when reconciliation changed anything; otherwise null.
 */
export function reconcileMarkdownTab(
  tab: MarkdownTab,
  doc: CollectionDocument
): Pick<MarkdownTab, 'content' | 'savedContent' | 'name' | 'folderId'> | null {
  const name = doc.name;
  const folderId = doc.folder_id;

  if (doc.content === tab.savedContent && tab.content !== tab.savedContent) {
    return { content: tab.savedContent, savedContent: tab.savedContent, name, folderId };
  }

  if (doc.content === tab.content && tab.content !== tab.savedContent) {
    return { content: tab.content, savedContent: tab.content, name, folderId };
  }

  if (!isTabDirty(tab) && doc.content !== tab.content) {
    return { content: doc.content, savedContent: doc.content, name, folderId };
  }

  if (tab.name !== name || tab.folderId !== folderId) {
    return {
      content: tab.content,
      savedContent: tab.savedContent,
      name,
      folderId
    };
  }

  return null;
}

/**
 * Aligns an open request tab's editor state with on-disk request content.
 *
 * Updates clean tabs when disk changed (pull, CLI, or another process). Leaves
 * real local edits alone when the tab is dirty.
 *
 * @param tab - Open request tab to reconcile.
 * @param req - Latest request loaded from storage for the same `draft.id`.
 * @returns Updated draft fields when reconciliation changed anything; otherwise null.
 */
export function reconcileRequestTab(
  tab: RequestTab,
  req: SavedRequest
): Pick<
  RequestTab,
  | 'draft'
  | 'savedDraft'
  | 'response'
  | 'testResults'
  | 'scriptLogs'
  | 'executionEvents'
  | 'scriptError'
> | null {
  if (isTabDirty(tab)) {
    return null;
  }

  const freshDraft = cloneDraft(draftFromSaved(req));
  if (normalizeDraftForCompare(tab.draft) === normalizeDraftForCompare(freshDraft)) {
    return null;
  }

  return {
    draft: freshDraft,
    savedDraft: cloneDraft(freshDraft),
    response: null,
    testResults: [],
    scriptLogs: [],
    executionEvents: [],
    scriptError: undefined
  };
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
 * Returns display names for open request and markdown tabs with unsaved changes.
 *
 * @param tabs - Open tabs from the tab bar.
 * @returns Tab labels suitable for quit and bulk-close prompts.
 */
export function getDirtyEditorTabNames(tabs: Tab[]): string[] {
  const names: string[] = [];
  for (const tab of tabs) {
    if (!isTabDirty(tab)) {
      continue;
    }
    if (isMarkdownTab(tab)) {
      names.push(tab.name);
      continue;
    }
    if (isRequestTab(tab)) {
      names.push(tab.draft.name);
    }
  }
  return names;
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
  comment: '',
  tags: ''
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
    testResults: [],
    scriptLogs: [],
    executionEvents: []
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
 * Resolves the folder id to persist when saving an existing request.
 *
 * Prefers the live sidebar cache over the tab draft so a sidebar move is not
 * overwritten by stale draft state.
 *
 * @param draft - Tab draft being saved.
 * @param collectionId - Target collection id for the save.
 * @param requestsByCollection - Cached saved requests keyed by collection id.
 * @returns Folder id to write, or null for collection root.
 */
export function resolvePersistFolderId(
  draft: RequestDraft,
  collectionId: number,
  requestsByCollection: Record<number, SavedRequest[]>
): number | null {
  if (draft.id == null) {
    return draft.folder_id ?? null;
  }
  const saved = (requestsByCollection[collectionId] ?? []).find(
    (request) => request.id === draft.id
  );
  return saved?.folder_id ?? draft.folder_id ?? null;
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
    comment: req.comment ?? '',
    tags: req.tags ?? ''
  });
}
