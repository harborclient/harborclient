import type { EntityContextMenuTarget, ShowEntityContextMenuInput } from '@harborclient/sdk';
import type { MenuPosition } from '@harborclient/sdk/components';
import {
  HC_PLUGIN_CONTRIBUTION_ATTR,
  HC_PLUGIN_ID_ATTR,
  HC_PLUGIN_SURFACE_ATTR
} from '#/renderer/src/ui/Sidebars/CollectionSidebar/navigation/focusCollectionsReplacementPanel';
import { emitPluginEntityContextMenuOpen } from './pluginEntityContextMenuBus';

/**
 * Host-side open request after validation and coordinate mapping.
 */
export interface EntityContextMenuOpenRequest {
  /** Validated entity target. */
  target: EntityContextMenuTarget;
  /** Menu top-left in host window viewport coordinates. */
  anchor: MenuPosition;
  /** Plugin that requested the menu (for focus return). */
  pluginId: string;
  /** Sidebar panel contribution id that requested the menu. */
  contributionId: string;
}

/**
 * Escapes a value for use inside a CSS attribute selector.
 *
 * @param value - Raw attribute value.
 * @returns Escaped value safe for `querySelector`.
 */
function escapeAttr(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Builds a CSS selector for a plugin HostedSurface container.
 *
 * @param pluginId - Plugin manifest id.
 * @param contributionId - Contribution id.
 * @returns Attribute selector targeting the HostedSurface container.
 */
export function pluginSurfaceSelector(pluginId: string, contributionId: string): string {
  return `[${HC_PLUGIN_SURFACE_ATTR}][${HC_PLUGIN_ID_ATTR}="${escapeAttr(pluginId)}"][${HC_PLUGIN_CONTRIBUTION_ATTR}="${escapeAttr(contributionId)}"]`;
}

/**
 * Maps plugin-webview-local coordinates to host renderer viewport coordinates.
 *
 * Locates the HostedSurface for `pluginId`/`contributionId` and offsets by its
 * bounding rect. When the surface is not found, returns the input coordinates
 * unchanged (caller-supplied host viewport fallback).
 *
 * @param pluginId - Plugin that owns the surface.
 * @param contributionId - Contribution mounted in the surface.
 * @param x - X in the plugin webview's viewport.
 * @param y - Y in the plugin webview's viewport.
 * @param documentRef - Document used for querySelector (injectable for tests).
 * @returns Host viewport coordinates for the menu anchor.
 */
export function mapPluginSurfaceToHostViewport(
  pluginId: string,
  contributionId: string,
  x: number,
  y: number,
  documentRef: ParentNode = document
): MenuPosition {
  const container = documentRef.querySelector(pluginSurfaceSelector(pluginId, contributionId));
  if (container == null || !('getBoundingClientRect' in container)) {
    return { x, y };
  }

  const rect = (container as Element).getBoundingClientRect();
  return {
    x: rect.left + x,
    y: rect.top + y
  };
}

/**
 * Validates a raw entity context menu target from a plugin host call.
 *
 * @param target - Raw target payload.
 * @returns Normalized target.
 * @throws When the target shape is invalid.
 */
export function validateEntityContextMenuTarget(target: unknown): EntityContextMenuTarget {
  if (!target || typeof target !== 'object') {
    throw new Error('harborclient.showEntityContextMenu requires a target object.');
  }
  const raw = target as Record<string, unknown>;
  if (raw.type === 'collection') {
    if (typeof raw.collectionId !== 'number' || !Number.isFinite(raw.collectionId)) {
      throw new Error(
        'harborclient.showEntityContextMenu collection target requires a numeric collectionId.'
      );
    }
    return { type: 'collection', collectionId: raw.collectionId };
  }
  if (raw.type === 'folder') {
    if (typeof raw.collectionId !== 'number' || !Number.isFinite(raw.collectionId)) {
      throw new Error(
        'harborclient.showEntityContextMenu folder target requires a numeric collectionId.'
      );
    }
    if (typeof raw.folderId !== 'number' || !Number.isFinite(raw.folderId)) {
      throw new Error(
        'harborclient.showEntityContextMenu folder target requires a numeric folderId.'
      );
    }
    return { type: 'folder', collectionId: raw.collectionId, folderId: raw.folderId };
  }
  if (raw.type === 'request') {
    if (typeof raw.requestId !== 'number' || !Number.isFinite(raw.requestId)) {
      throw new Error(
        'harborclient.showEntityContextMenu request target requires a numeric requestId.'
      );
    }
    return { type: 'request', requestId: raw.requestId };
  }
  throw new Error(
    'harborclient.showEntityContextMenu target.type must be "collection", "folder", or "request".'
  );
}

/**
 * Validates and shows a host-mediated entity context menu for a plugin.
 *
 * Maps webview-local coordinates to the host viewport, then emits on the
 * entity context menu bus for {@link HostEntityContextMenuLayer}.
 *
 * @param input - Target, coordinates, and requesting surface identity.
 * @throws When the payload is invalid.
 */
export function showEntityContextMenuForPlugin(input: ShowEntityContextMenuInput): void {
  if (!input || typeof input !== 'object') {
    throw new Error('harborclient.showEntityContextMenu requires an input object.');
  }
  if (typeof input.pluginId !== 'string' || !input.pluginId.trim()) {
    throw new Error('harborclient.showEntityContextMenu requires a non-empty pluginId.');
  }
  if (typeof input.contributionId !== 'string' || !input.contributionId.trim()) {
    throw new Error('harborclient.showEntityContextMenu requires a non-empty contributionId.');
  }
  if (typeof input.x !== 'number' || !Number.isFinite(input.x)) {
    throw new Error('harborclient.showEntityContextMenu requires a numeric x.');
  }
  if (typeof input.y !== 'number' || !Number.isFinite(input.y)) {
    throw new Error('harborclient.showEntityContextMenu requires a numeric y.');
  }

  const target = validateEntityContextMenuTarget(input.target);
  const anchor = mapPluginSurfaceToHostViewport(
    input.pluginId,
    input.contributionId,
    input.x,
    input.y
  );

  emitPluginEntityContextMenuOpen({
    target,
    anchor,
    pluginId: input.pluginId.trim(),
    contributionId: input.contributionId.trim()
  });
}
