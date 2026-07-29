/**
 * Renderer-side mirror of plugin chat-pointer registrations for copy-to-chat validation.
 */

export interface RendererPluginChatPointerRegistration {
  /**
   * Owning plugin manifest id.
   */
  pluginId: string;

  /**
   * Pointer id segment.
   */
  pointerId: string;

  /**
   * Agent-scoped registration id.
   */
  registrationId: string;
}

const registrations = new Map<string, RendererPluginChatPointerRegistration>();

/**
 * Builds the map key for one renderer-side registration.
 *
 * @param pluginId - Plugin manifest id.
 * @param registrationId - Agent-scoped registration id.
 */
function keyOf(pluginId: string, registrationId: string): string {
  return `${pluginId}::${registrationId}`;
}

/**
 * Records that a plugin registered a chat pointer (host renderer mirror).
 *
 * @param input - Registration metadata from the main-process broker.
 */
export function trackPluginChatPointer(input: {
  pluginId: string;
  registrationId: string;
  pointerId: string;
}): void {
  registrations.set(keyOf(input.pluginId, input.registrationId), {
    pluginId: input.pluginId,
    registrationId: input.registrationId,
    pointerId: input.pointerId
  });
}

/**
 * Removes one tracked plugin chat-pointer registration.
 *
 * @param pluginId - Plugin manifest id.
 * @param registrationId - Agent-scoped registration id.
 */
export function untrackPluginChatPointer(pluginId: string, registrationId: string): void {
  registrations.delete(keyOf(pluginId, registrationId));
}

/**
 * Clears tracked chat pointers for one plugin.
 *
 * @param pluginId - Plugin manifest id.
 */
export function clearTrackedPluginChatPointers(pluginId: string): void {
  for (const [key, entry] of [...registrations.entries()]) {
    if (entry.pluginId === pluginId) {
      registrations.delete(key);
    }
  }
}

/**
 * Returns whether the plugin currently has the pointer id registered.
 *
 * @param pluginId - Plugin manifest id.
 * @param pointerId - Pointer id segment.
 */
export function isTrackedPluginChatPointer(pluginId: string, pointerId: string): boolean {
  for (const entry of registrations.values()) {
    if (entry.pluginId === pluginId && entry.pointerId === pointerId) {
      return true;
    }
  }
  return false;
}
