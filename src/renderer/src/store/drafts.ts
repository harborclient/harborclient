import type {
  BodyType,
  HttpMethod,
  KeyValue,
  SavedRequest,
  ScriptTestResult,
  SendResult
} from '#/shared/types';
import { defaultAuth, normalizeAuth, type AuthConfig } from '#/shared/auth';
import { applyParamsToUrl } from '#/shared/queryParams';

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
 * Ensures a draft has all required fields, including script defaults for legacy persisted tabs.
 *
 * @param draft - Partial or full draft from storage or the database.
 * @returns Draft with script fields guaranteed to be strings.
 */
export function normalizeDraft(draft: RequestDraft): RequestDraft {
  return {
    ...draft,
    pre_request_script: draft.pre_request_script ?? '',
    post_request_script: draft.post_request_script ?? '',
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
 * @param tab - Open request tab.
 * @returns True when the tab draft differs from its saved baseline.
 */
export function isTabDirty(tab: RequestTab): boolean {
  return isDraftDirty(tab.draft, tab.savedDraft);
}

/**
 * Returns all open tabs that have unsaved changes.
 *
 * @param tabs - Open request tabs.
 * @returns Tabs whose draft differs from its saved baseline.
 */
export function getDirtyTabs(tabs: RequestTab[]): RequestTab[] {
  return tabs.filter(isTabDirty);
}

/**
 * Returns an empty key-value row with enabled set to true.
 *
 * @returns Blank KeyValue entry for editors.
 */
export const emptyKeyValue = (): KeyValue => ({ key: '', value: '', enabled: true });

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
  return syncDraftUrlWithParams({
    id: req.id,
    collection_id: req.collection_id,
    folder_id: req.folder_id,
    name: req.name,
    method: req.method,
    url: req.url,
    headers: req.headers.length ? req.headers : [emptyKeyValue()],
    params: req.params.length ? req.params : [emptyKeyValue()],
    auth: normalizeAuth(req.auth),
    body: req.body,
    body_type: req.body_type,
    pre_request_script: req.pre_request_script ?? '',
    post_request_script: req.post_request_script ?? '',
    comment: req.comment ?? ''
  });
}
