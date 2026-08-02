import type { RuntimeKind } from '@harborclient/core/types';

/**
 * Prefill values for opening the Add Runtime modal from import warnings.
 */
export interface PendingRuntimeDraft {
  /**
   * Runtime kind to preselect.
   */
  kind: RuntimeKind;

  /**
   * Declared major.minor version to preselect when present in the catalog.
   */
  version: string;

  /**
   * Optional display name from the export requirement.
   */
  name?: string;
}

let pendingDraft: PendingRuntimeDraft | null = null;

/**
 * Queues a runtime draft to open when Settings → Runtimes mounts.
 *
 * @param draft - Kind/version (and optional name) to prefill.
 */
export function setPendingRuntimeDraft(draft: PendingRuntimeDraft): void {
  pendingDraft = draft;
}

/**
 * Consumes and clears any queued runtime draft.
 *
 * @returns Pending draft, or null when none was queued.
 */
export function consumePendingRuntimeDraft(): PendingRuntimeDraft | null {
  const draft = pendingDraft;
  pendingDraft = null;
  return draft;
}
