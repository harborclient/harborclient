import type { RootState } from '#/renderer/src/store/redux';
import { isRequestTab } from '#/renderer/src/store/tabs';
import {
  findTabByIdentity,
  parseWorkflowTabIdentity,
  type WorkflowTabIdentity
} from './workflowIdentity';
import { findSavedRequestByUuid } from './workflowPlaybackHelpers';

/**
 * Request-family action types that carry method/name/url for timeline display.
 */
const REQUEST_DISPLAY_TYPES = new Set([
  'request.load',
  'request.draft',
  'request.save',
  'request.create'
]);

/**
 * Display fields copied onto incomplete `request.send` payloads.
 */
export interface RequestDisplayFields {
  /**
   * HTTP method from the latest preceding request action.
   */
  method?: string;

  /**
   * Request display name from the latest preceding request action.
   */
  name?: string;

  /**
   * Optional URL from the latest preceding request action.
   */
  url?: string;
}

/**
 * Optional context for resolving tab-identity display fields.
 */
export interface EnrichWorkflowSendDisplayOptions {
  /**
   * Redux getter used to resolve `tab.activate` identities into method/name/url.
   */
  getState?: () => RootState;
}

/**
 * Reads a string field from an unknown payload object.
 *
 * @param payload - Action payload.
 * @param key - Property name.
 * @returns Trimmed string value, or undefined.
 */
function payloadString(payload: unknown, key: string): string | undefined {
  if (payload == null || typeof payload !== 'object') {
    return undefined;
  }
  const value = (payload as Record<string, unknown>)[key];
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Extracts method/name/url from a request-family action payload.
 *
 * @param payload - Action payload that may include display fields.
 * @returns Partial display fields present on the payload.
 */
function readDisplayFields(payload: unknown): RequestDisplayFields {
  return {
    method: payloadString(payload, 'method'),
    name: payloadString(payload, 'name'),
    url: payloadString(payload, 'url')
  };
}

/**
 * Returns whether a send payload already has both method and name for the shared block.
 *
 * @param payload - `request.send` payload.
 * @returns True when the shared send thumbnail can render without enrichment.
 */
function hasSendDisplayFields(payload: unknown): boolean {
  const fields = readDisplayFields(payload);
  return fields.method != null && fields.name != null;
}

/**
 * Resolves method/name/url for a request tab identity from open tabs or the
 * saved-request cache.
 *
 * Prefers the live open-tab draft when present so unsaved renames show on the
 * timeline; falls back to the cached SavedRequest.
 *
 * @param state - Root Redux state.
 * @param identity - Portable tab identity from `tab.activate`.
 * @returns Display fields when the identity refers to a known request.
 */
export function resolveRequestDisplayFromTabIdentity(
  state: RootState,
  identity: WorkflowTabIdentity
): RequestDisplayFields {
  if (identity.kind !== 'request') {
    return {};
  }

  const tabId = findTabByIdentity(state, identity);
  if (tabId != null) {
    const tab = state.tabs.tabs.find((entry) => entry.tabId === tabId);
    if (tab != null && isRequestTab(tab)) {
      return {
        method: tab.draft.method,
        name: tab.draft.name,
        url: tab.draft.url
      };
    }
  }

  const saved = findSavedRequestByUuid(state, identity.requestUuid);
  if (saved == null) {
    return {};
  }
  return {
    method: saved.method,
    name: saved.name,
    url: saved.url
  };
}

/**
 * Merges partial display fields onto a send payload, preserving existing keys.
 *
 * @param payload - Existing send payload.
 * @param fields - Method/name/url to fill when missing.
 * @returns New payload object with display fields applied.
 */
function applyDisplayFields(payload: unknown, fields: RequestDisplayFields): unknown {
  const base =
    payload != null && typeof payload === 'object'
      ? { ...(payload as Record<string, unknown>) }
      : {};
  return {
    ...base,
    method: payloadString(payload, 'method') ?? fields.method,
    name: payloadString(payload, 'name') ?? fields.name,
    ...(fields.url != null && payloadString(payload, 'url') == null ? { url: fields.url } : {})
  };
}

/**
 * Copies method/name/url from preceding request / tab.activate actions onto
 * incomplete sends.
 *
 * Walks the list in order and tracks:
 * 1. Latest `request.load` / `draft` / `save` / `create` display fields
 * 2. Latest `tab.activate` identity (resolved via {@link getState} when provided)
 *
 * Each `request.send` missing method or name receives those fields while keeping
 * `target` and other payload keys. Actions that already have method+name are
 * left unchanged. Returns a new array.
 *
 * Used so record, play, and edit timelines all show shared send content for the
 * same logical sends (including legacy `{ target: 'active' }` and send →
 * tab.activate → send workflows).
 *
 * @param actions - Workflow actions or recorder events in timeline order.
 * @param options - Optional store accessor for tab-identity resolution.
 * @returns New action list with enriched send display fields.
 */
export function enrichWorkflowSendDisplayFields<
  T extends { type: string; payload: unknown; uuid?: string; at?: number }
>(actions: readonly T[], options?: EnrichWorkflowSendDisplayOptions): T[] {
  let latest: RequestDisplayFields = {};
  let latestTabIdentity: WorkflowTabIdentity | null = null;
  const getState = options?.getState;

  const firstPass = actions.map((action) => {
    if (REQUEST_DISPLAY_TYPES.has(action.type)) {
      const next = readDisplayFields(action.payload);
      latest = {
        method: next.method ?? latest.method,
        name: next.name ?? latest.name,
        url: next.url ?? latest.url
      };
      return action;
    }

    if (action.type === 'tab.activate') {
      const identity = parseWorkflowTabIdentity(
        (action.payload as { identity?: unknown } | undefined)?.identity
      );
      if (identity != null) {
        latestTabIdentity = identity;
        if (getState != null && identity.kind === 'request') {
          const fromTab = resolveRequestDisplayFromTabIdentity(getState(), identity);
          if (fromTab.method != null && fromTab.name != null) {
            latest = {
              method: fromTab.method,
              name: fromTab.name,
              url: fromTab.url ?? latest.url
            };
          }
        }
      }
      return action;
    }

    if (action.type !== 'request.send') {
      return action;
    }

    if (hasSendDisplayFields(action.payload)) {
      return action;
    }

    let fields = latest;
    if (
      (fields.method == null || fields.name == null) &&
      getState != null &&
      latestTabIdentity != null
    ) {
      const fromTab = resolveRequestDisplayFromTabIdentity(getState(), latestTabIdentity);
      fields = {
        method: fields.method ?? fromTab.method,
        name: fields.name ?? fromTab.name,
        url: fields.url ?? fromTab.url
      };
    }

    if (fields.method == null || fields.name == null) {
      return action;
    }

    return {
      ...action,
      payload: applyDisplayFields(action.payload, fields)
    };
  });

  if (getState == null) {
    return firstPass;
  }

  /**
   * Fills remaining bare sends from the next `tab.activate` that follows them
   * (send → focus → send workflows where the first send has no prior identity).
   */
  return firstPass.map((action, index) => {
    if (action.type !== 'request.send' || hasSendDisplayFields(action.payload)) {
      return action;
    }
    for (let i = index + 1; i < firstPass.length; i += 1) {
      const next = firstPass[i];
      if (next == null) {
        break;
      }
      if (next.type === 'request.send') {
        break;
      }
      if (next.type !== 'tab.activate') {
        continue;
      }
      const identity = parseWorkflowTabIdentity(
        (next.payload as { identity?: unknown } | undefined)?.identity
      );
      if (identity == null) {
        continue;
      }
      const fromTab = resolveRequestDisplayFromTabIdentity(getState(), identity);
      if (fromTab.method == null || fromTab.name == null) {
        continue;
      }
      return {
        ...action,
        payload: applyDisplayFields(action.payload, fromTab)
      };
    }
    return action;
  });
}
