import type { SavedRequest } from '@harborclient/core/types';
import type { PageRef, RequestDraft } from '#/renderer/src/store/tabs';
import type { WorkflowEvent } from './workflowEventTypes';

/**
 * Minimal registry shape needed to build record/play lookup maps.
 */
interface WorkflowRegistryMapEntry {
  /**
   * Stable logical event type.
   */
  eventType: string;

  /**
   * Redux action type string(s) this entry handles.
   */
  match: string | readonly string[];
}

/**
 * Builds a workflow event with a fresh timestamp and uuid.
 *
 * @param type - Logical event type.
 * @param payload - Normalized payload.
 * @returns Timestamped workflow event with a stable action uuid.
 */
export function event(type: string, payload: unknown): WorkflowEvent {
  return { uuid: crypto.randomUUID(), type, at: Date.now(), payload };
}

/**
 * Returns whether a value looks like a saved request payload for loadRequest.
 *
 * @param value - Unknown payload candidate.
 * @returns True when the value has the fields needed for request.load.
 */
export function isSavedRequest(value: unknown): value is SavedRequest {
  if (typeof value !== 'object' || value == null) {
    return false;
  }
  const req = value as Partial<SavedRequest>;
  return typeof req.id === 'number' && typeof req.uuid === 'string' && typeof req.name === 'string';
}

/**
 * Returns whether a value looks like a request draft for setActiveDraft.
 *
 * @param value - Unknown payload candidate.
 * @returns True when the value has core draft fields.
 */
export function isRequestDraft(value: unknown): value is RequestDraft {
  if (typeof value !== 'object' || value == null) {
    return false;
  }
  const draft = value as Partial<RequestDraft>;
  return (
    typeof draft.name === 'string' &&
    typeof draft.method === 'string' &&
    typeof draft.url === 'string' &&
    Array.isArray(draft.headers)
  );
}

/**
 * Returns whether a value looks like a page reference for openPageTab.
 *
 * @param value - Unknown payload candidate.
 * @returns True when the value has a page type string.
 */
export function isPageRef(value: unknown): value is PageRef {
  return typeof value === 'object' && value != null && typeof (value as PageRef).type === 'string';
}

/**
 * Builds a lookup map from Redux action type to registry entry.
 *
 * @param entries - Registry entries to index.
 * @returns Map of action type → entry.
 */
export function buildWorkflowRegistryMap<T extends WorkflowRegistryMapEntry>(
  entries: readonly T[]
): Map<string, T> {
  const map = new Map<string, T>();
  for (const entry of entries) {
    const matches = typeof entry.match === 'string' ? [entry.match] : entry.match;
    for (const type of matches) {
      map.set(type, entry);
    }
  }
  return map;
}

/**
 * Builds a lookup map from logical workflow event type to registry entry.
 *
 * @param entries - Registry entries to index.
 * @returns Map of event type → entry.
 */
export function buildWorkflowPlaybackMap<T extends WorkflowRegistryMapEntry>(
  entries: readonly T[]
): Map<string, T> {
  const map = new Map<string, T>();
  for (const entry of entries) {
    map.set(entry.eventType, entry);
  }
  return map;
}
