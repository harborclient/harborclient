/**
 * Token grammar helpers for plugin-namespaced `@plugin…` chat pointers.
 */

/**
 * Allowed plugin id segment in `@plugin.<pluginId>.…` (manifest-style ids).
 */
export const PLUGIN_CHAT_POINTER_ID_PATTERN = '[a-z0-9][a-z0-9._-]*';

/**
 * Allowed pointer id segment registered via `hc.ai.registerChatPointer`.
 */
export const PLUGIN_CHAT_POINTER_POINTER_ID_PATTERN = '[a-z][a-z0-9-]*';

/**
 * Allowed opaque key segment after the pointer id (no spaces).
 */
export const PLUGIN_CHAT_POINTER_KEY_PATTERN = '[A-Za-z0-9._~-]+';

/**
 * Validates a plugin chat-pointer id segment.
 *
 * @param value - Candidate pointer id.
 * @returns True when the id matches the registry grammar.
 */
export function isValidPluginChatPointerId(value: string): boolean {
  return new RegExp(`^${PLUGIN_CHAT_POINTER_POINTER_ID_PATTERN}$`).test(value);
}

/**
 * Validates an opaque plugin chat-pointer key segment.
 *
 * @param value - Candidate key.
 * @returns True when the key matches the token grammar.
 */
export function isValidPluginChatPointerKey(value: string): boolean {
  return new RegExp(`^${PLUGIN_CHAT_POINTER_KEY_PATTERN}$`).test(value);
}

/**
 * Builds a compact `@plugin.<pluginId>.<pointerId>.<key>` token.
 *
 * @param pluginId - Owning plugin id.
 * @param pointerId - Registered pointer id.
 * @param key - Opaque key segment.
 * @param selection - Optional character-range suffix.
 * @returns Full `@` token for the composer.
 * @throws When pluginId, pointerId, or key fail the token grammar.
 */
export function buildPluginChatPointerToken(
  pluginId: string,
  pointerId: string,
  key: string,
  selection?: { start: number; end: number }
): string {
  if (!new RegExp(`^${PLUGIN_CHAT_POINTER_ID_PATTERN}$`).test(pluginId)) {
    throw new Error(`Invalid plugin id for chat pointer token: ${pluginId}`);
  }
  if (!isValidPluginChatPointerId(pointerId)) {
    throw new Error(`Invalid chat pointer id: ${pointerId}`);
  }
  if (!isValidPluginChatPointerKey(key)) {
    throw new Error(`Invalid chat pointer key: ${key}`);
  }

  const base = `@plugin.${pluginId}.${pointerId}.${key}`;
  if (selection == null) {
    return base;
  }

  return `${base}#${selection.start}.${selection.end}`;
}

/**
 * Alias exported for SDK docs / callers that only need the key pattern name from the plan.
 */
export const PLUGIN_CHAT_POINTER_KEY_PATTERN_EXPORT = PLUGIN_CHAT_POINTER_KEY_PATTERN;
