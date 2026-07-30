import type {
  BodyType,
  BrowserSecurityState,
  CollectionDocument,
  HttpMethod,
  KeyValue,
  SavedRequest,
  ScriptRef,
  ScriptRunError,
  ScriptTestResult,
  ScriptExecutionEvent,
  SendResult,
  SettingsSection,
  Variable
} from '@harborclient/core/types';
import { defaultAuth, normalizeAuth, type AuthConfig } from '@harborclient/core/auth';
import { applyParamsToUrl } from '@harborclient/core/queryParams';
import {
  mirrorLegacyScriptString,
  normalizeScriptRefsForCompare,
  resolveScriptRefs
} from '@harborclient/core/scriptRefs';
import { normalizeRequestTags } from '@harborclient/core/requestTags';
import { routePageRefKey } from '#/renderer/src/store/routing';
import { areBrowserScriptsDirty, type BrowserInjectionScript } from '#/browser/browserScripts';
import { areBrowserHcScriptsDirty } from '#/browser/browserHcScripts';

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
   * Request-level User-Agent override; empty inherits folder → collection → global.
   */
  userAgent: string;

  /**
   * Raw request body content.
   */
  body: string;

  /**
   * Content type of the request body.
   */
  body_type: BodyType;

  /**
   * Verbatim Raw body override; null when the structured editor is authoritative.
   */
  body_raw: string | null;

  /**
   * When true, the Raw body drawer is open in the request editor.
   */
  body_raw_open: boolean;

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
   * Structured script failures with slot metadata and mapped locations for the
   * latest completed send; drives in-editor error squiggles.
   */
  scriptErrors?: ScriptRunError[];

  /**
   * Next request name from hc.execution.setNextRequest for collection runner flow control.
   */
  scriptNextRequest?: string | null;

  /**
   * When true, hc.execution.skipRequest() skipped the latest send in this tab.
   */
  scriptSkipRequest?: boolean;

  /**
   * Target workflow action UUID from hc.execution.workflowNextAction for the latest send.
   */
  scriptWorkflowNextAction?: string;

  /**
   * When true, hc.execution.workflowSkipAction() skipped the latest workflow action send.
   */
  scriptWorkflowSkipAction?: boolean;

  /**
   * Last selected response viewer sub-tab (Body, Tests, etc.) for this request
   * tab. Session-only so remounting after opening a script-editor page restores
   * the user's choice instead of defaulting to Body.
   */
  responseViewerTab?: string;
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
  | { type: 'openapi-import' }
  | { type: 'cookies' }
  | { type: 'team-hubs' }
  | { type: 'team-hub-admin'; hubId: string; label?: string }
  | { type: 'sharing-keys' }
  | { type: 'hosted-main-view'; pluginId: string; viewId: string }
  | { type: 'collection'; id: number; focusVariableKey?: string; focusSection?: string }
  | { type: 'folder'; collectionId: number; id: number; focusVariableKey?: string }
  | { type: 'environment'; id: number; focusVariableKey?: string }
  | { type: 'workspace'; id: number }
  | {
      type: 'collection-runner';
      collectionId: number;
      folderId?: number | null;
      requestId?: number | null;
      requestIds?: number[] | null;
    }
  | {
      type: 'workflow-run-results';
      /**
       * Portable workflow uuid whose in-memory run log this page displays.
       */
      workflowUuid: string;
    }
  | {
      type: 'live-server-logs';
      /**
       * Saved live server id whose Express request log this page displays.
       */
      savedId: number;
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
      type: 'response-viewer';
      /**
       * Request tab that owns the live response data shown in this page.
       */
      requestTabId: string;
      /**
       * Built-in response viewer sub-tab to render full-page.
       */
      viewerTab: 'body' | 'preview' | 'headers' | 'timing' | 'console' | 'redirects' | 'tests';
      /**
       * Tab bar title (request name plus viewer tab label).
       */
      label: string;
    }
  | {
      type: 'script-editor';
      requestTabId: string;
      phase: 'pre' | 'post';
      scriptId: string;
      label: string;
      /**
       * 1-based line to reveal when opening from a test failure or script error.
       */
      revealLine?: number;
      /**
       * 1-based column to reveal; when omitted the whole line is selected.
       */
      revealColumn?: number;
      /**
       * Assertion failure or script error message shown as a CodeMirror error underline tooltip.
       */
      revealMessage?: string;
      /**
       * Marker origin: `test` for assertion failures, `script` for runtime/compile errors.
       */
      revealSource?: 'test' | 'script';
      /**
       * Changes on each navigation so an already-open editor remounts to the new selection.
       */
      revealNonce?: number;
    }
  | {
      type: 'merge-editor';
      connectionId: string;
      filePath: string;
      label: string;
    }
  | {
      type: 'theme-stylesheet';
      label: string;
    }
  | {
      type: 'image-view';
      /**
       * Full filename shown in the page header.
       */
      fileName: string;
      /**
       * Shortened filename shown in the tab bar.
       */
      shortLabel: string;
      /**
       * Image bytes source for display, copy, and download.
       */
      source:
        | { kind: 'path'; path: string }
        | { kind: 'url'; url: string }
        | { kind: 'data'; dataUrl: string };
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
 * Open embedded browser tab with navigation state and injection scripts.
 */
export interface BrowserTab {
  /**
   * Stable client-side id for this open tab instance.
   */
  tabId: string;

  /**
   * Discriminator that marks this tab as an embedded browser.
   */
  kind: 'browser';

  /**
   * Document title shown in the tab bar (falls back to hostname).
   */
  title: string;

  /**
   * Address bar / last committed URL.
   */
  url: string;

  /**
   * URL loaded by the Home control.
   */
  homeUrl: string;

  /**
   * Editable injection scripts (draft until Save in browser settings).
   */
  scripts: BrowserInjectionScript[];

  /**
   * Last-saved scripts used for injection and dirty comparison.
   */
  savedScripts: BrowserInjectionScript[];

  /**
   * Editable pre-request hc.* scripts (draft until Save).
   */
  pre_request_scripts: ScriptRef[];

  /**
   * Editable post-request hc.* scripts (draft until Save).
   */
  post_request_scripts: ScriptRef[];

  /**
   * Last-saved pre-request scripts applied on navigation.
   */
  savedPreRequestScripts: ScriptRef[];

  /**
   * Last-saved post-request scripts applied after load.
   */
  savedPostRequestScripts: ScriptRef[];

  /**
   * Editable website-scoped variables (draft until Save in live page settings).
   */
  variables: Variable[];

  /**
   * Last-saved website-scoped variables baseline.
   */
  savedVariables: Variable[];

  /**
   * Editable headers sent with chrome-driven navigations (draft until Save).
   */
  headers: KeyValue[];

  /**
   * Last-saved headers baseline.
   */
  savedHeaders: KeyValue[];

  /**
   * Editable User-Agent override for chrome-driven navigations (draft until Save).
   */
  userAgent: string;

  /**
   * Last-saved User-Agent baseline.
   */
  savedUserAgent: string;

  /**
   * Editable authorization for chrome-driven navigations (draft until Save).
   */
  auth: AuthConfig;

  /**
   * Last-saved authorization baseline.
   */
  savedAuth: AuthConfig;

  /**
   * Whether the guest history can go back.
   */
  canGoBack: boolean;

  /**
   * Whether the guest history can go forward.
   */
  canGoForward: boolean;

  /**
   * Site favicon as a data URL for the tab bar and sidebar.
   */
  faviconDataUrl: string | null;

  /**
   * Address-bar TLS indicator from the guest (not persisted).
   */
  securityState: BrowserSecurityState;

  /**
   * Linked saved website database id when this tab was opened from or saved as a Website.
   */
  websiteId: number | null;

  /**
   * Linked saved website portable uuid when bound to a Website entity.
   */
  websiteUuid: string | null;

  /**
   * Last-saved URL baseline for dirty comparison when linked to a website.
   */
  savedUrl: string;

  /**
   * Last-saved home URL baseline for dirty comparison when linked to a website.
   */
  savedHomeUrl: string;

  /**
   * Last-saved title baseline for dirty comparison when linked to a website.
   */
  savedTitle: string;

  /**
   * Last-saved favicon baseline for dirty comparison when linked to a website.
   */
  savedFaviconDataUrl: string | null;

  /**
   * When true, the live page settings panel is open under the address bar chrome.
   */
  settingsPanelOpen: boolean;

  /**
   * Draft live page display name from settings (independent of the document title).
   *
   * Browsing updates {@link title} for the tab bar; renaming in live page settings
   * updates this field so unsaved name edits survive remounts without ambering on
   * ordinary page-title drift.
   */
  settingsName: string;
}

/**
 * Discriminated union of open request editor tabs.
 */
export type Tab = RequestTab | PageTab | MarkdownTab | BrowserTab;

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
 * Returns whether a tab hosts an embedded browser guest.
 *
 * @param tab - Open tab from the tab bar.
 * @returns True when the tab is a browser tab.
 */
export function isBrowserTab(tab: Tab): tab is BrowserTab {
  return 'kind' in tab && tab.kind === 'browser';
}

/**
 * Returns whether a tab hosts an HTTP request editor.
 *
 * @param tab - Open tab from the tab bar.
 * @returns True when the tab is a request tab (including legacy persisted tabs without kind).
 */
export function isRequestTab(tab: Tab): tab is RequestTab {
  return !isPageTab(tab) && !isMarkdownTab(tab) && !isBrowserTab(tab);
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
  return routePageRefKey(page);
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
    auth: normalizeAuth(draft.auth),
    userAgent: draft.userAgent ?? ''
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
    body_raw: draft.body_raw ?? null,
    body_raw_open: draft.body_raw_open === true,
    pre_request_script: draft.pre_request_script ?? '',
    post_request_script: draft.post_request_script ?? '',
    pre_request_scripts: normalizeScriptRefsForCompare(draft.pre_request_scripts),
    post_request_scripts: normalizeScriptRefsForCompare(draft.post_request_scripts),
    comment: draft.comment ?? '',
    tags: normalizeRequestTags(draft.tags ?? ''),
    auth: draft.auth,
    userAgent: draft.userAgent ?? '',
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
 * Optional fields used when opening a browser tab with a known URL or inherited settings.
 */
export interface CreateBrowserTabInit {
  /**
   * Stable client-side id; when omitted a new UUID is generated.
   * Playback reuses recorded ids so later browser.* steps can target the same tab.
   */
  tabId?: string;

  /**
   * Initial address-bar / load URL.
   */
  url?: string;

  /**
   * Home control URL.
   */
  homeUrl?: string;

  /**
   * Editable injection scripts (draft).
   */
  scripts?: BrowserInjectionScript[];

  /**
   * Last-saved scripts used for injection and dirty comparison.
   */
  savedScripts?: BrowserInjectionScript[];

  /**
   * Editable pre-request hc.* scripts (draft).
   */
  pre_request_scripts?: ScriptRef[];

  /**
   * Editable post-request hc.* scripts (draft).
   */
  post_request_scripts?: ScriptRef[];

  /**
   * Last-saved pre-request scripts.
   */
  savedPreRequestScripts?: ScriptRef[];

  /**
   * Last-saved post-request scripts.
   */
  savedPostRequestScripts?: ScriptRef[];

  /**
   * Editable website-scoped variables (draft).
   */
  variables?: Variable[];

  /**
   * Last-saved website-scoped variables.
   */
  savedVariables?: Variable[];

  /**
   * Editable headers for chrome-driven navigations (draft).
   */
  headers?: KeyValue[];

  /**
   * Last-saved headers.
   */
  savedHeaders?: KeyValue[];

  /**
   * Editable User-Agent override (draft).
   */
  userAgent?: string;

  /**
   * Last-saved User-Agent.
   */
  savedUserAgent?: string;

  /**
   * Editable authorization (draft).
   */
  auth?: AuthConfig;

  /**
   * Last-saved authorization.
   */
  savedAuth?: AuthConfig;

  /**
   * Linked saved website database id.
   */
  websiteId?: number | null;

  /**
   * Linked saved website portable uuid.
   */
  websiteUuid?: string | null;

  /**
   * Display title for the tab bar.
   */
  title?: string;

  /**
   * Favicon data URL.
   */
  faviconDataUrl?: string | null;

  /**
   * Last-saved URL baseline when linked to a website.
   */
  savedUrl?: string;

  /**
   * Last-saved home URL baseline when linked to a website.
   */
  savedHomeUrl?: string;

  /**
   * Last-saved title baseline when linked to a website.
   */
  savedTitle?: string;

  /**
   * Last-saved favicon baseline when linked to a website.
   */
  savedFaviconDataUrl?: string | null;

  /**
   * Draft live page display name from settings.
   */
  settingsName?: string;
}

/**
 * Deep-clones a browser injection script list so tabs do not share mutable state.
 *
 * @param scripts - Scripts to clone.
 * @returns Independent copy of each script.
 */
function cloneBrowserScripts(scripts: BrowserInjectionScript[]): BrowserInjectionScript[] {
  return scripts.map((script) => ({ ...script }));
}

/**
 * Deep-clones ScriptRef lists so tabs do not share mutable state.
 *
 * @param scripts - Script references to clone.
 * @returns Independent copy of each reference.
 */
function cloneScriptRefs(scripts: ScriptRef[]): ScriptRef[] {
  return scripts.map((script) => ({ ...script }));
}

/**
 * Deep-clones variable rows so tabs do not share mutable state.
 *
 * @param variables - Variables to clone.
 * @returns Independent copy of each row.
 */
function cloneVariables(variables: Variable[]): Variable[] {
  return variables.map((variable) => ({ ...variable }));
}

/**
 * Deep-clones key/value rows so tabs do not share mutable state.
 *
 * @param rows - Header rows to clone.
 * @returns Independent copy of each row.
 */
function cloneKeyValues(rows: KeyValue[]): KeyValue[] {
  return rows.map((row) => ({ ...row }));
}

/**
 * Deep-clones an auth config so tabs do not share mutable state.
 *
 * @param auth - Auth config to clone.
 * @returns Independent normalized copy.
 */
function cloneAuth(auth: AuthConfig): AuthConfig {
  const normalized = normalizeAuth(auth);
  return {
    ...normalized,
    basic: { ...normalized.basic },
    bearer: { ...normalized.bearer },
    oauth2: { ...normalized.oauth2 }
  };
}

/**
 * Serializes variables for dirty comparison.
 *
 * @param variables - Variable rows.
 * @returns Stable JSON string.
 */
function serializeBrowserVariables(variables: Variable[]): string {
  return JSON.stringify(
    variables
      .filter((row) => row.key.trim() || row.value.trim() || row.defaultValue.trim())
      .map((row) => ({
        key: row.key,
        value: row.value,
        defaultValue: row.defaultValue,
        enabled: row.enabled !== false,
        share: row.share === true
      }))
  );
}

/**
 * Serializes headers for dirty comparison.
 *
 * @param headers - Header rows.
 * @returns Stable JSON string.
 */
function serializeBrowserHeaders(headers: KeyValue[]): string {
  return JSON.stringify(
    headers
      .filter((row) => row.key.trim() || row.value.trim())
      .map((row) => ({
        key: row.key,
        value: row.value,
        enabled: row.enabled !== false
      }))
  );
}

/**
 * Creates a new embedded browser tab.
 *
 * Defaults to about:blank with empty scripts. Callers may pass an initial URL and/or
 * inherited home/scripts from an opener tab (for example guest `window.open()`).
 * Optional `tabId` reuses a recorded id during workflow playback.
 *
 * @param init - Optional tab id, initial URL, home URL, and script lists.
 * @returns New BrowserTab with a unique tabId (or the provided one).
 */
export function createBrowserTab(init?: CreateBrowserTabInit): BrowserTab {
  const scripts = cloneBrowserScripts(init?.scripts ?? []);
  const savedScripts = cloneBrowserScripts(init?.savedScripts ?? scripts);
  const pre_request_scripts = cloneScriptRefs(init?.pre_request_scripts ?? []);
  const post_request_scripts = cloneScriptRefs(init?.post_request_scripts ?? []);
  const savedPreRequestScripts = cloneScriptRefs(
    init?.savedPreRequestScripts ?? pre_request_scripts
  );
  const savedPostRequestScripts = cloneScriptRefs(
    init?.savedPostRequestScripts ?? post_request_scripts
  );
  const variables = cloneVariables(init?.variables ?? []);
  const savedVariables = cloneVariables(init?.savedVariables ?? variables);
  const headers = cloneKeyValues(init?.headers ?? []);
  const savedHeaders = cloneKeyValues(init?.savedHeaders ?? headers);
  const userAgent = init?.userAgent ?? '';
  const savedUserAgent = init?.savedUserAgent ?? userAgent;
  const auth = cloneAuth(init?.auth ?? defaultAuth());
  const savedAuth = cloneAuth(init?.savedAuth ?? auth);
  const url = init?.url ?? 'about:blank';
  const homeUrl = init?.homeUrl ?? 'about:blank';
  const title = init?.title ?? 'New Browser';
  const faviconDataUrl = init?.faviconDataUrl ?? null;
  return {
    tabId: init?.tabId ?? crypto.randomUUID(),
    kind: 'browser',
    title,
    url,
    homeUrl,
    scripts,
    savedScripts,
    pre_request_scripts,
    post_request_scripts,
    savedPreRequestScripts,
    savedPostRequestScripts,
    variables,
    savedVariables,
    headers,
    savedHeaders,
    userAgent,
    savedUserAgent,
    auth,
    savedAuth,
    canGoBack: false,
    canGoForward: false,
    faviconDataUrl,
    securityState: 'unknown',
    websiteId: init?.websiteId ?? null,
    websiteUuid: init?.websiteUuid ?? null,
    savedUrl: init?.savedUrl ?? url,
    savedHomeUrl: init?.savedHomeUrl ?? homeUrl,
    savedTitle: init?.savedTitle ?? title,
    savedFaviconDataUrl:
      init?.savedFaviconDataUrl !== undefined ? init.savedFaviconDataUrl : faviconDataUrl,
    settingsPanelOpen: false,
    settingsName: init?.settingsName ?? init?.savedTitle ?? title
  };
}

/**
 * Returns whether a linked browser tab's navigation chrome differs from its saved website baseline.
 *
 * @param tab - Browser tab to compare.
 * @returns True when url, home, title, or favicon drifted from the last save.
 */
export function areBrowserWebsiteFieldsDirty(tab: BrowserTab): boolean {
  if (tab.websiteId == null) {
    return false;
  }
  return (
    tab.url !== tab.savedUrl ||
    tab.homeUrl !== tab.savedHomeUrl ||
    tab.title !== tab.savedTitle ||
    tab.faviconDataUrl !== tab.savedFaviconDataUrl
  );
}

/**
 * Returns whether live page settings drafts differ from their last-saved baselines.
 *
 * Covers the settings name, injection / hc.* scripts, variables, headers, user-agent,
 * and auth. Excludes URL / document-title / favicon drift from browsing so navigation
 * does not amber the tab — use {@link hasBrowserPendingSave} for Update live page.
 *
 * @param tab - Browser tab to compare against its last-saved settings baselines.
 * @returns True when settings drafts differ from the last save.
 */
export function areBrowserSettingsDirty(tab: BrowserTab): boolean {
  return (
    tab.settingsName !== tab.savedTitle ||
    areBrowserScriptsDirty(tab.scripts, tab.savedScripts) ||
    areBrowserHcScriptsDirty(tab.pre_request_scripts, tab.savedPreRequestScripts) ||
    areBrowserHcScriptsDirty(tab.post_request_scripts, tab.savedPostRequestScripts) ||
    serializeBrowserVariables(tab.variables) !== serializeBrowserVariables(tab.savedVariables) ||
    serializeBrowserHeaders(tab.headers) !== serializeBrowserHeaders(tab.savedHeaders) ||
    tab.userAgent.trim() !== tab.savedUserAgent.trim() ||
    JSON.stringify(normalizeAuth(tab.auth)) !== JSON.stringify(normalizeAuth(tab.savedAuth))
  );
}

/**
 * Returns whether a browser tab has website or script changes worth persisting.
 *
 * Used by Update website / browser settings affordances. Includes linked website
 * navigation field drift (url, home, title, favicon) in addition to settings drafts.
 *
 * @param tab - Browser tab to compare against its last-saved baselines.
 * @returns True when scripts, settings, or linked website fields differ from the last save.
 */
export function hasBrowserPendingSave(tab: BrowserTab): boolean {
  return areBrowserSettingsDirty(tab) || areBrowserWebsiteFieldsDirty(tab);
}

/**
 * Returns whether a tab has unsaved changes for editor chrome and close/quit prompts.
 *
 * Browser tabs are dirty when live page settings drafts diverge (not when only
 * browsing updates url/title). Use {@link hasBrowserPendingSave} for Update live page.
 *
 * @param tab - Open tab from the tab bar.
 * @returns True when a request, markdown, or browser settings tab differs from its saved baseline.
 */
export function isTabDirty(tab: Tab): boolean {
  if (isMarkdownTab(tab)) {
    return tab.content !== tab.savedContent;
  }
  if (isBrowserTab(tab)) {
    return areBrowserSettingsDirty(tab);
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
  | 'scriptErrors'
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
    scriptError: undefined,
    scriptErrors: undefined
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
 * Returns display names for open request, markdown, and browser tabs with unsaved changes.
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
    if (isBrowserTab(tab)) {
      names.push(tab.title || 'Browser');
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
  userAgent: '',
  body: '',
  body_type: 'none',
  body_raw: null,
  body_raw_open: false,
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
    userAgent: req.userAgent ?? '',
    body: req.body,
    body_type: req.body_type,
    body_raw: req.body_raw ?? null,
    body_raw_open: req.body_raw_open === true,
    pre_request_script: mirrorLegacyScriptString(preRequestScripts),
    post_request_script: mirrorLegacyScriptString(postRequestScripts),
    pre_request_scripts: preRequestScripts,
    post_request_scripts: postRequestScripts,
    comment: req.comment ?? '',
    tags: req.tags ?? ''
  });
}
