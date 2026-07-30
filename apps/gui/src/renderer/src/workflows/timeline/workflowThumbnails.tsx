import type { ReactNode } from 'react';
import type { PageRef } from '#/renderer/src/store/tabs';
import {
  faAngleLeft,
  faAngleRight,
  faArrowsRotate,
  faFileLines,
  faFolder,
  faGlobe,
  faHouse,
  faLayerGroup,
  faPaperPlane,
  faPlus,
  faStop,
  faWindowMaximize,
  faXmark
} from '#/renderer/src/fontawesome';
import { isWorkflowRunRequestResult } from '../isWorkflowRunRequestResult';
import { WorkflowRunRequestStatus } from '../WorkflowRunRequestStatus';
import type { WorkflowThumbnailCtx } from '../workflowEventTypes';
import { TimelineRequestThumbnail } from './TimelineRequestThumbnail';
import { TimelineTextThumbnail } from './TimelineTextThumbnail';
import { WorkflowSendActionContent } from './WorkflowSendActionContent';

/**
 * Human-readable summary for a timeline block / detail strip.
 */
export interface WorkflowActionDescription {
  /**
   * Primary label shown in the block and aria-label.
   */
  title: string;

  /**
   * Optional secondary detail (URL, page type, etc.).
   */
  subtitle?: string;
}

/**
 * Reads a string field from an unknown payload object.
 *
 * @param payload - Recorded action payload.
 * @param key - Property name.
 * @returns String value, or undefined.
 */
function payloadString(payload: unknown, key: string): string | undefined {
  if (payload == null || typeof payload !== 'object') {
    return undefined;
  }
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Formats a PageRef into a short display title and subtitle.
 *
 * @param page - Recorded page reference.
 * @returns Title / subtitle for page.open blocks.
 */
function describePage(page: PageRef): WorkflowActionDescription {
  switch (page.type) {
    case 'settings':
      return { title: 'Settings', subtitle: page.section };
    case 'collection':
      return { title: 'Collection', subtitle: `id ${page.id}` };
    case 'folder':
      return { title: 'Folder', subtitle: `id ${page.id}` };
    case 'environment':
      return { title: 'Environment page', subtitle: `id ${page.id}` };
    case 'workspace':
      return { title: 'Workspace page', subtitle: `id ${page.id}` };
    case 'getting-started':
      return { title: 'Getting started' };
    case 'plugins':
      return { title: 'Plugins' };
    case 'themes':
      return { title: 'Themes' };
    case 'snippets':
      return { title: 'Snippets' };
    case 'cookies':
      return { title: 'Cookies' };
    case 'team-hubs':
      return { title: 'Team hubs' };
    case 'sharing-keys':
      return { title: 'Sharing keys' };
    case 'openapi-import':
      return { title: 'OpenAPI import' };
    case 'plugin-detail':
      return { title: page.label || 'Plugin', subtitle: page.id };
    case 'snippet-detail':
      return { title: page.label || 'Snippet' };
    case 'snippet-edit':
      return { title: page.label || 'Edit snippet' };
    case 'response-viewer':
      return { title: page.label || 'Response', subtitle: page.viewerTab };
    case 'script-editor':
      return { title: page.label || 'Script editor' };
    case 'collection-runner':
      return { title: 'Collection runner' };
    case 'workflow-run-results':
      return { title: 'Workflow results', subtitle: page.workflowUuid.slice(0, 8) };
    case 'live-server-logs':
      return { title: 'Live server logs', subtitle: `id ${page.savedId}` };
    case 'team-hub-admin':
      return { title: page.label || 'Team hub admin' };
    case 'hosted-main-view':
      return { title: 'Plugin view', subtitle: page.viewId };
    case 'merge-editor':
      return { title: page.label || 'Merge editor' };
    case 'theme-stylesheet':
      return { title: page.label || 'Theme stylesheet' };
    case 'image-view':
      return { title: page.shortLabel || page.fileName || 'Image' };
    default:
      return { title: 'Page' };
  }
}

/**
 * Formats a tab identity payload into a short label.
 *
 * @param identity - Recorded tab identity fragment.
 * @returns Display subtitle for tab actions.
 */
function describeTabIdentity(identity: unknown): string | undefined {
  if (identity == null || typeof identity !== 'object') {
    return undefined;
  }
  const value = identity as {
    kind?: string;
    requestUuid?: string;
    documentId?: number;
    documentUuid?: string;
    tabId?: string;
    page?: PageRef;
  };
  if (value.kind === 'request') {
    return value.requestUuid != null ? `Request ${value.requestUuid.slice(0, 8)}` : 'Request tab';
  }
  if (value.kind === 'markdown') {
    return value.documentUuid != null
      ? `Doc ${value.documentUuid.slice(0, 8)}`
      : value.documentId != null
        ? `Doc #${value.documentId}`
        : 'Markdown';
  }
  if (value.kind === 'page' && value.page != null) {
    return describePage(value.page).title;
  }
  if (value.kind === 'browser') {
    return value.tabId != null ? `Browser ${value.tabId.slice(0, 8)}` : 'Browser tab';
  }
  if (value.kind === 'blank') {
    return 'Blank tab';
  }
  return value.kind;
}

/**
 * Builds a human-readable description for a recorded workflow action.
 *
 * @param action - Recorded workflow action.
 * @param ctx - Optional thumbnail context for environment name lookup.
 * @returns Title and optional subtitle.
 */
export function describeWorkflowAction(
  action: { type: string; at?: number; payload: unknown },
  ctx?: WorkflowThumbnailCtx
): WorkflowActionDescription {
  const payload = action.payload;

  switch (action.type) {
    case 'request.load':
    case 'request.draft':
    case 'request.save':
    case 'request.create': {
      const name = payloadString(payload, 'name') ?? 'Request';
      const method = payloadString(payload, 'method');
      const url = payloadString(payload, 'url');
      return {
        title: method != null ? `${method} ${name}` : name,
        subtitle: url
      };
    }
    case 'request.send': {
      const requestResult =
        ctx?.result != null && isWorkflowRunRequestResult(ctx.result) ? ctx.result : null;
      const method = requestResult?.method ?? payloadString(payload, 'method');
      const name = requestResult?.name ?? payloadString(payload, 'name');
      if (method != null && name != null) {
        return {
          title: `${method} ${name}`,
          subtitle: requestResult?.url ?? payloadString(payload, 'url')
        };
      }
      if (name != null) {
        return { title: name, subtitle: payloadString(payload, 'url') };
      }
      return { title: 'Send' };
    }
    case 'request.cancel':
      return { title: 'Cancel send' };
    case 'environment.activate': {
      const environmentId =
        payload != null && typeof payload === 'object'
          ? (payload as { environmentId?: number | null }).environmentId
          : undefined;
      if (environmentId == null) {
        return { title: 'Clear environment' };
      }
      const state = ctx?.getState?.();
      const env = state?.environments.environments.find((entry) => entry.id === environmentId);
      return {
        title: env?.name ?? `Environment #${environmentId}`,
        subtitle: 'Environment'
      };
    }
    case 'workspace.open': {
      const name = payloadString(payload, 'name') ?? 'Workspace';
      const count =
        payload != null && typeof payload === 'object'
          ? (payload as { requestUuids?: unknown[] }).requestUuids?.length
          : undefined;
      return {
        title: name,
        subtitle:
          typeof count === 'number' ? `${count} request${count === 1 ? '' : 's'}` : undefined
      };
    }
    case 'page.open': {
      const page =
        payload != null && typeof payload === 'object'
          ? (payload as { page?: PageRef }).page
          : undefined;
      if (page == null) {
        return { title: 'Open page' };
      }
      const described = describePage(page);
      return { title: `Open ${described.title}`, subtitle: described.subtitle };
    }
    case 'tab.activate': {
      const identity =
        payload != null && typeof payload === 'object'
          ? (payload as { identity?: unknown }).identity
          : undefined;
      return { title: 'Focus tab', subtitle: describeTabIdentity(identity) };
    }
    case 'tab.new':
      return { title: 'New tab' };
    case 'tab.close': {
      const identity =
        payload != null && typeof payload === 'object'
          ? (payload as { identity?: unknown }).identity
          : undefined;
      return { title: 'Close tab', subtitle: describeTabIdentity(identity) };
    }
    case 'tab.closeAll':
      return { title: 'Close all tabs' };
    case 'browser.tab.new': {
      const url = payloadString(payload, 'url');
      return {
        title: 'New browser',
        subtitle: url != null && url !== 'about:blank' ? url : undefined
      };
    }
    case 'browser.navigate':
      return { title: 'Navigate', subtitle: payloadString(payload, 'url') };
    case 'browser.back':
      return { title: 'Back' };
    case 'browser.forward':
      return { title: 'Forward' };
    case 'browser.reload':
      return { title: 'Reload' };
    case 'browser.home':
      return { title: 'Home' };
    default:
      return { title: action.type };
  }
}

/**
 * Renders a request-family thumbnail from payload fields.
 *
 * @param action - Recorded action with method/name/url.
 * @param ctx - Density context.
 * @param fallbackMethod - Method when payload omits it (e.g. create).
 * @returns Request thumbnail node.
 */
function requestThumbnail(
  action: { type: string; at?: number; payload: unknown },
  ctx: WorkflowThumbnailCtx,
  fallbackMethod = 'GET'
): ReactNode {
  const method = payloadString(action.payload, 'method') ?? fallbackMethod;
  const name = payloadString(action.payload, 'name') ?? 'Request';
  const url = payloadString(action.payload, 'url');
  return <TimelineRequestThumbnail method={method} name={name} url={url} compact={ctx.compact} />;
}

/**
 * Timeline thumbnail for `request.load`.
 *
 * @param action - Recorded action.
 * @param ctx - Thumbnail context.
 * @returns Thumbnail content.
 */
export function requestLoadThumbnail(
  action: { type: string; at?: number; payload: unknown },
  ctx: WorkflowThumbnailCtx
): ReactNode {
  return requestThumbnail(action, ctx);
}

/**
 * Timeline thumbnail for `request.draft`.
 *
 * @param action - Recorded action.
 * @param ctx - Thumbnail context.
 * @returns Thumbnail content.
 */
export function requestDraftThumbnail(
  action: { type: string; at?: number; payload: unknown },
  ctx: WorkflowThumbnailCtx
): ReactNode {
  return requestThumbnail(action, ctx);
}

/**
 * Timeline thumbnail for `request.save`.
 *
 * @param action - Recorded action.
 * @param ctx - Thumbnail context.
 * @returns Thumbnail content.
 */
export function requestSaveThumbnail(
  action: { type: string; at?: number; payload: unknown },
  ctx: WorkflowThumbnailCtx
): ReactNode {
  return requestThumbnail(action, ctx);
}

/**
 * Timeline thumbnail for `request.create`.
 *
 * @param action - Recorded action.
 * @param ctx - Thumbnail context.
 * @returns Thumbnail content.
 */
export function requestCreateThumbnail(
  action: { type: string; at?: number; payload: unknown },
  ctx: WorkflowThumbnailCtx
): ReactNode {
  const name = payloadString(action.payload, 'name') ?? 'New request';
  return <TimelineRequestThumbnail method="GET" name={name} compact={ctx.compact} />;
}

/**
 * Timeline thumbnail for `request.send`.
 *
 * Prefers method/name from a run-log request result when present (Results), then
 * recorded display fields on the action payload. Legacy sends without those
 * fields fall back to the paper-plane “Send” label.
 *
 * @param action - Recorded action.
 * @param ctx - Thumbnail context (optional run result for status metrics).
 * @returns Thumbnail content.
 */
export function requestSendThumbnail(
  action: { type: string; at?: number; payload: unknown },
  ctx: WorkflowThumbnailCtx
): ReactNode {
  const requestResult =
    ctx.result != null && isWorkflowRunRequestResult(ctx.result) ? ctx.result : null;
  const method = requestResult?.method ?? payloadString(action.payload, 'method');
  const name = requestResult?.name ?? payloadString(action.payload, 'name');

  if (method == null || name == null) {
    return <TimelineTextThumbnail icon={faPaperPlane} title="Send" compact={ctx.compact} />;
  }

  return (
    <WorkflowSendActionContent
      method={method}
      name={name}
      compact={ctx.compact}
      actions={
        requestResult != null ? (
          <WorkflowRunRequestStatus result={requestResult} className="ms-auto" />
        ) : undefined
      }
    />
  );
}

/**
 * Timeline thumbnail for `request.cancel`.
 *
 * @param _action - Recorded action.
 * @param ctx - Thumbnail context.
 * @returns Thumbnail content.
 */
export function requestCancelThumbnail(
  _action: { type: string; at?: number; payload: unknown },
  ctx: WorkflowThumbnailCtx
): ReactNode {
  return <TimelineTextThumbnail icon={faStop} title="Cancel send" compact={ctx.compact} />;
}

/**
 * Timeline thumbnail for `environment.activate`.
 *
 * @param action - Recorded action.
 * @param ctx - Thumbnail context.
 * @returns Thumbnail content.
 */
export function environmentActivateThumbnail(
  action: { type: string; at?: number; payload: unknown },
  ctx: WorkflowThumbnailCtx
): ReactNode {
  const described = describeWorkflowAction(action, ctx);
  return (
    <TimelineTextThumbnail
      icon={faGlobe}
      title={described.title}
      subtitle={described.subtitle}
      compact={ctx.compact}
    />
  );
}

/**
 * Timeline thumbnail for `workspace.open`.
 *
 * @param action - Recorded action.
 * @param ctx - Thumbnail context.
 * @returns Thumbnail content.
 */
export function workspaceOpenThumbnail(
  action: { type: string; at?: number; payload: unknown },
  ctx: WorkflowThumbnailCtx
): ReactNode {
  const described = describeWorkflowAction(action, ctx);
  return (
    <TimelineTextThumbnail
      icon={faFolder}
      title={described.title}
      subtitle={described.subtitle}
      compact={ctx.compact}
    />
  );
}

/**
 * Timeline thumbnail for `page.open`.
 *
 * @param action - Recorded action.
 * @param ctx - Thumbnail context.
 * @returns Thumbnail content.
 */
export function pageOpenThumbnail(
  action: { type: string; at?: number; payload: unknown },
  ctx: WorkflowThumbnailCtx
): ReactNode {
  const described = describeWorkflowAction(action, ctx);
  return (
    <TimelineTextThumbnail
      icon={faFileLines}
      title={described.title}
      subtitle={described.subtitle}
      compact={ctx.compact}
    />
  );
}

/**
 * Timeline thumbnail for `tab.activate`.
 *
 * @param action - Recorded action.
 * @param ctx - Thumbnail context.
 * @returns Thumbnail content.
 */
export function tabActivateThumbnail(
  action: { type: string; at?: number; payload: unknown },
  ctx: WorkflowThumbnailCtx
): ReactNode {
  const described = describeWorkflowAction(action, ctx);
  return (
    <TimelineTextThumbnail
      icon={faWindowMaximize}
      title={described.title}
      subtitle={described.subtitle}
      compact={ctx.compact}
    />
  );
}

/**
 * Timeline thumbnail for `tab.new`.
 *
 * @param _action - Recorded action.
 * @param ctx - Thumbnail context.
 * @returns Thumbnail content.
 */
export function tabNewThumbnail(
  _action: { type: string; at?: number; payload: unknown },
  ctx: WorkflowThumbnailCtx
): ReactNode {
  return <TimelineTextThumbnail icon={faPlus} title="New tab" compact={ctx.compact} />;
}

/**
 * Timeline thumbnail for `tab.close`.
 *
 * @param action - Recorded action.
 * @param ctx - Thumbnail context.
 * @returns Thumbnail content.
 */
export function tabCloseThumbnail(
  action: { type: string; at?: number; payload: unknown },
  ctx: WorkflowThumbnailCtx
): ReactNode {
  const described = describeWorkflowAction(action, ctx);
  return (
    <TimelineTextThumbnail
      icon={faXmark}
      title={described.title}
      subtitle={described.subtitle}
      compact={ctx.compact}
    />
  );
}

/**
 * Timeline thumbnail for `tab.closeAll`.
 *
 * @param _action - Recorded action.
 * @param ctx - Thumbnail context.
 * @returns Thumbnail content.
 */
export function tabCloseAllThumbnail(
  _action: { type: string; at?: number; payload: unknown },
  ctx: WorkflowThumbnailCtx
): ReactNode {
  return <TimelineTextThumbnail icon={faLayerGroup} title="Close all tabs" compact={ctx.compact} />;
}

/**
 * Timeline thumbnail for `browser.tab.new`.
 *
 * @param action - Recorded action.
 * @param ctx - Thumbnail context.
 * @returns Thumbnail content.
 */
export function browserTabNewThumbnail(
  action: { type: string; at?: number; payload: unknown },
  ctx: WorkflowThumbnailCtx
): ReactNode {
  const described = describeWorkflowAction(action, ctx);
  return (
    <TimelineTextThumbnail
      icon={faGlobe}
      title={described.title}
      subtitle={described.subtitle}
      compact={ctx.compact}
    />
  );
}

/**
 * Timeline thumbnail for `browser.navigate`.
 *
 * @param action - Recorded action.
 * @param ctx - Thumbnail context.
 * @returns Thumbnail content.
 */
export function browserNavigateThumbnail(
  action: { type: string; at?: number; payload: unknown },
  ctx: WorkflowThumbnailCtx
): ReactNode {
  const described = describeWorkflowAction(action, ctx);
  return (
    <TimelineTextThumbnail
      icon={faGlobe}
      title={described.title}
      subtitle={described.subtitle}
      compact={ctx.compact}
    />
  );
}

/**
 * Timeline thumbnail for `browser.back`.
 *
 * @param action - Recorded action.
 * @param ctx - Thumbnail context.
 * @returns Thumbnail content.
 */
export function browserBackThumbnail(
  action: { type: string; at?: number; payload: unknown },
  ctx: WorkflowThumbnailCtx
): ReactNode {
  const described = describeWorkflowAction(action, ctx);
  return <TimelineTextThumbnail icon={faAngleLeft} title={described.title} compact={ctx.compact} />;
}

/**
 * Timeline thumbnail for `browser.forward`.
 *
 * @param action - Recorded action.
 * @param ctx - Thumbnail context.
 * @returns Thumbnail content.
 */
export function browserForwardThumbnail(
  action: { type: string; at?: number; payload: unknown },
  ctx: WorkflowThumbnailCtx
): ReactNode {
  const described = describeWorkflowAction(action, ctx);
  return (
    <TimelineTextThumbnail icon={faAngleRight} title={described.title} compact={ctx.compact} />
  );
}

/**
 * Timeline thumbnail for `browser.reload`.
 *
 * @param action - Recorded action.
 * @param ctx - Thumbnail context.
 * @returns Thumbnail content.
 */
export function browserReloadThumbnail(
  action: { type: string; at?: number; payload: unknown },
  ctx: WorkflowThumbnailCtx
): ReactNode {
  const described = describeWorkflowAction(action, ctx);
  return (
    <TimelineTextThumbnail icon={faArrowsRotate} title={described.title} compact={ctx.compact} />
  );
}

/**
 * Timeline thumbnail for `browser.home`.
 *
 * @param action - Recorded action.
 * @param ctx - Thumbnail context.
 * @returns Thumbnail content.
 */
export function browserHomeThumbnail(
  action: { type: string; at?: number; payload: unknown },
  ctx: WorkflowThumbnailCtx
): ReactNode {
  const described = describeWorkflowAction(action, ctx);
  return <TimelineTextThumbnail icon={faHouse} title={described.title} compact={ctx.compact} />;
}
