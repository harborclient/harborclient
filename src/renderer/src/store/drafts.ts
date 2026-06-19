import type { BodyType, HttpMethod, KeyValue, SavedRequest, SendResult } from '#/shared/types';

/** Editable request state in the UI before or during save. */
export interface RequestDraft {
  id?: number;
  collection_id?: number;
  name: string;
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: string;
  body_type: BodyType;
}

/** Open request tab with draft, response, and in-flight state. */
export interface RequestTab {
  tabId: string;
  draft: RequestDraft;
  savedDraft: RequestDraft;
  response: SendResult | null;
  sending: boolean;
}

/**
 * Returns a shallow copy of a draft with cloned header/param arrays.
 *
 * @param draft - Draft to clone.
 * @returns Independent copy safe to use as a saved baseline.
 */
export function cloneDraft(draft: RequestDraft): RequestDraft {
  return {
    ...draft,
    headers: draft.headers.map((h) => ({ ...h })),
    params: draft.params.map((p) => ({ ...p }))
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
  body: '',
  body_type: 'none'
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
    sending: false
  };
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
  };
}
