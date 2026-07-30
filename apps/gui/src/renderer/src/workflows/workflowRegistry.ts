import type { WorkflowRegistryEntry, WorkflowThumbnailCtx } from './workflowEventTypes';
import type { ReactNode } from 'react';
import { WORKFLOW_REGISTRY_CORE } from './workflowRegistryCore';
import {
  browserBackThumbnail,
  browserForwardThumbnail,
  browserHomeThumbnail,
  browserNavigateThumbnail,
  browserReloadThumbnail,
  browserTabNewThumbnail,
  environmentActivateThumbnail,
  pageOpenThumbnail,
  requestCancelThumbnail,
  requestCreateThumbnail,
  requestDraftThumbnail,
  requestLoadThumbnail,
  requestSaveThumbnail,
  requestSendThumbnail,
  tabActivateThumbnail,
  tabCloseAllThumbnail,
  tabCloseThumbnail,
  tabNewThumbnail,
  workspaceOpenThumbnail
} from './timeline/workflowThumbnails';

type ThumbnailFn = (
  action: { type: string; at?: number; payload: unknown },
  ctx: WorkflowThumbnailCtx
) => ReactNode;

/**
 * Thumbnail renderer keyed by logical workflow event type.
 */
const WORKFLOW_THUMBNAILS: Record<string, ThumbnailFn> = {
  'request.load': requestLoadThumbnail,
  'request.draft': requestDraftThumbnail,
  'request.send': requestSendThumbnail,
  'request.save': requestSaveThumbnail,
  'request.create': requestCreateThumbnail,
  'request.cancel': requestCancelThumbnail,
  'environment.activate': environmentActivateThumbnail,
  'page.open': pageOpenThumbnail,
  'workspace.open': workspaceOpenThumbnail,
  'tab.activate': tabActivateThumbnail,
  'tab.new': tabNewThumbnail,
  'tab.close': tabCloseThumbnail,
  'tab.closeAll': tabCloseAllThumbnail,
  'browser.tab.new': browserTabNewThumbnail,
  'browser.navigate': browserNavigateThumbnail,
  'browser.back': browserBackThumbnail,
  'browser.forward': browserForwardThumbnail,
  'browser.reload': browserReloadThumbnail,
  'browser.home': browserHomeThumbnail
};

/**
 * Fallback thumbnail when an event type has no dedicated renderer.
 *
 * @param action - Recorded action.
 * @returns Plain text of the event type.
 */
function fallbackThumbnail(
  action: { type: string; at?: number; payload: unknown },
  _ctx: WorkflowThumbnailCtx
): ReactNode {
  void _ctx;
  return action.type;
}

/**
 * Allowlisted Redux actions that become workflow events, including timeline thumbnails.
 *
 * Record / play handlers live in {@link WORKFLOW_REGISTRY_CORE}; this module attaches
 * UI thumbnails so playback tests can import the core registry without React.
 */
export const WORKFLOW_REGISTRY: readonly WorkflowRegistryEntry[] = WORKFLOW_REGISTRY_CORE.map(
  (entry) => ({
    ...entry,
    thumbnail: WORKFLOW_THUMBNAILS[entry.eventType] ?? fallbackThumbnail
  })
);

/**
 * Looks up a full registry entry (including thumbnail) by event type.
 *
 * @param eventType - Logical workflow event type.
 * @returns Registry entry, or undefined when unknown.
 */
export function getWorkflowRegistryEntry(eventType: string): WorkflowRegistryEntry | undefined {
  return WORKFLOW_REGISTRY.find((entry) => entry.eventType === eventType);
}
