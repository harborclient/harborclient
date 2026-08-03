/**
 * Renderer-side mirror of plugin chat-pointer registrations for copy-to-chat
 * validation and custom match definition registration.
 */

import {
  registerCustomPluginChatPointerDefinition,
  unregisterCustomPluginChatPointerDefinition,
  refreshAiScriptReferencePattern
} from '@harborclient/core/ai/scriptReferences';

/**
 * Renderer-side plugin chat-pointer registration.
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

  /**
   * Normalized custom match source when registered with `match` + `parse`.
   */
  matchSource?: string;

  /**
   * Optional agent guidance for custom-match definitions.
   */
  agentGuidance?: string;
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
 * Recomputes whether any registration still needs a custom definition for a pointer.
 *
 * @param pluginId - Plugin id.
 * @param pointerId - Pointer id.
 */
function syncCustomDefinitionForPointer(pluginId: string, pointerId: string): void {
  const remaining = [...registrations.values()].filter(
    (entry) =>
      entry.pluginId === pluginId && entry.pointerId === pointerId && entry.matchSource != null
  );
  if (remaining.length === 0) {
    unregisterCustomPluginChatPointerDefinition(pluginId, pointerId);
    refreshAiScriptReferencePattern();
    return;
  }

  const primary = remaining[0]!;
  registerCustomPluginChatPointerDefinition({
    pluginId,
    pointerId,
    match: primary.matchSource!,
    agentGuidance: primary.agentGuidance
  });
  refreshAiScriptReferencePattern();
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
  matchSource?: string;
  agentGuidance?: string;
}): void {
  const previous = registrations.get(keyOf(input.pluginId, input.registrationId));
  registrations.set(keyOf(input.pluginId, input.registrationId), {
    pluginId: input.pluginId,
    registrationId: input.registrationId,
    pointerId: input.pointerId,
    ...(input.matchSource != null ? { matchSource: input.matchSource } : {}),
    ...(input.agentGuidance != null ? { agentGuidance: input.agentGuidance } : {})
  });

  if (previous != null && previous.pointerId !== input.pointerId) {
    syncCustomDefinitionForPointer(previous.pluginId, previous.pointerId);
  }
  syncCustomDefinitionForPointer(input.pluginId, input.pointerId);
}

/**
 * Removes one tracked plugin chat-pointer registration.
 *
 * @param pluginId - Plugin manifest id.
 * @param registrationId - Agent-scoped registration id.
 */
export function untrackPluginChatPointer(pluginId: string, registrationId: string): void {
  const key = keyOf(pluginId, registrationId);
  const existing = registrations.get(key);
  if (existing == null) {
    return;
  }
  registrations.delete(key);
  syncCustomDefinitionForPointer(existing.pluginId, existing.pointerId);
}

/**
 * Clears tracked chat pointers for one plugin.
 *
 * @param pluginId - Plugin manifest id.
 */
export function clearTrackedPluginChatPointers(pluginId: string): void {
  const pointerIds = new Set<string>();
  for (const [key, entry] of [...registrations.entries()]) {
    if (entry.pluginId === pluginId) {
      pointerIds.add(entry.pointerId);
      registrations.delete(key);
    }
  }
  for (const pointerId of pointerIds) {
    syncCustomDefinitionForPointer(pluginId, pointerId);
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

/**
 * Returns the first tracked registration for a plugin pointer id.
 *
 * @param pluginId - Plugin manifest id.
 * @param pointerId - Pointer id.
 * @returns Registration or undefined.
 */
export function getTrackedPluginChatPointer(
  pluginId: string,
  pointerId: string
): RendererPluginChatPointerRegistration | undefined {
  for (const entry of registrations.values()) {
    if (entry.pluginId === pluginId && entry.pointerId === pointerId) {
      return entry;
    }
  }
  return undefined;
}
