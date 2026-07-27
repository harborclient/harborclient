import { getRegisteredSidebarPanels } from '#/renderer/src/plugins/registry';
import { selectCollectionsReplacementPanel } from '../shell/sidebarPanelResolution';

/** Attribute marking a HostedSurface container for focus targeting. */
export const HC_PLUGIN_SURFACE_ATTR = 'data-hc-plugin-surface';

/** Attribute carrying the plugin id on a HostedSurface container. */
export const HC_PLUGIN_ID_ATTR = 'data-hc-plugin-id';

/** Attribute carrying the contribution id on a HostedSurface container. */
export const HC_PLUGIN_CONTRIBUTION_ATTR = 'data-hc-contribution-id';

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
 * Builds a CSS selector for the collections-replacement sidebar panel surface.
 *
 * @param pluginId - Winning replacement panel plugin id.
 * @param contributionId - Winning replacement panel contribution id.
 * @returns Attribute selector targeting the HostedSurface container.
 */
export function collectionsReplacementSurfaceSelector(
  pluginId: string,
  contributionId: string
): string {
  return `[${HC_PLUGIN_SURFACE_ATTR}="sidebarPanels"][${HC_PLUGIN_ID_ATTR}="${escapeAttr(pluginId)}"][${HC_PLUGIN_CONTRIBUTION_ATTR}="${escapeAttr(contributionId)}"]`;
}

/**
 * Focuses the winning `replaces: "collections"` plugin sidebar webview, if mounted.
 *
 * Waits two animation frames so React can mount the surface after the host
 * reveals the primary sidebar panel (`activeSidebarPanelId = null`).
 *
 * @returns True when a replacement panel was targeted (focus may still no-op if
 *   the webview is not in the DOM yet).
 */
export function focusCollectionsReplacementPanel(): boolean {
  const replacement = selectCollectionsReplacementPanel(getRegisteredSidebarPanels());
  if (replacement == null) {
    return false;
  }

  /**
   * Waits two animation frames so the HostedSurface webview can mount after
   * navigation dispatches reveal the primary collections surface.
   */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const container = document.querySelector(
        collectionsReplacementSurfaceSelector(replacement.pluginId, replacement.contributionId)
      );
      if (container == null || !('querySelector' in container)) {
        return;
      }
      const webview = (container as ParentNode).querySelector('webview');
      if (webview != null && 'focus' in webview && typeof webview.focus === 'function') {
        (webview as HTMLElement).focus();
        return;
      }
      if ('focus' in container && typeof (container as HTMLElement).focus === 'function') {
        (container as HTMLElement).focus();
      }
    });
  });

  return true;
}
