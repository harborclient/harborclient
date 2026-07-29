import type { ChatPointerDefinition } from './types.js';

/**
 * Registered chat-pointer definitions keyed by id (`request-script`, `plugin`, …).
 */
const pointersById = new Map<string, ChatPointerDefinition>();

/**
 * Plugin-contributed agent guidance keyed by `${pluginId}::${pointerId}`.
 */
const pluginGuidanceByKey = new Map<string, string>();

/**
 * Registers a chat-pointer definition.
 *
 * @param definition - Pointer match/parse/validate/expand contract.
 * @throws When another pointer is already registered under the same id.
 */
export function registerChatPointer(definition: ChatPointerDefinition): void {
  if (pointersById.has(definition.id)) {
    throw new Error(`Chat pointer already registered: ${definition.id}`);
  }
  pointersById.set(definition.id, definition);
}

/**
 * Removes a previously registered chat-pointer definition.
 *
 * @param id - Pointer id passed to {@link registerChatPointer}.
 */
export function unregisterChatPointer(id: string): void {
  pointersById.delete(id);
}

/**
 * Returns one registered chat-pointer definition when present.
 *
 * @param id - Pointer id.
 * @returns Definition or undefined.
 */
export function getChatPointer(id: string): ChatPointerDefinition | undefined {
  return pointersById.get(id);
}

/**
 * Returns all registered chat-pointer definitions in registration order.
 *
 * @returns Readonly list of definitions.
 */
export function getRegisteredChatPointers(): readonly ChatPointerDefinition[] {
  return [...pointersById.values()];
}

/**
 * Joins non-empty builtin (and other registered) `agentGuidance` strings.
 *
 * @returns Multi-line guidance block for the agent system prompt, or empty string.
 */
export function getChatPointerAgentGuidance(): string {
  const parts: string[] = [];
  for (const pointer of pointersById.values()) {
    const guidance = pointer.agentGuidance?.trim();
    if (guidance) {
      parts.push(guidance);
    }
  }
  const pluginGuidance = getPluginChatPointerGuidance();
  if (pluginGuidance) {
    parts.push(pluginGuidance);
  }
  return parts.join('\n');
}

/**
 * Registers activation-scoped agent guidance for a plugin chat pointer.
 *
 * @param pluginId - Owning plugin id.
 * @param pointerId - Pointer id segment declared by the plugin.
 * @param guidance - Static prompt fragment while the plugin is loaded.
 * @returns Dispose function that removes the guidance entry.
 */
export function registerPluginChatPointerGuidance(
  pluginId: string,
  pointerId: string,
  guidance: string
): () => void {
  const key = `${pluginId}::${pointerId}`;
  const trimmed = guidance.trim();
  if (trimmed) {
    pluginGuidanceByKey.set(key, trimmed);
  }
  return () => {
    pluginGuidanceByKey.delete(key);
  };
}

/**
 * Returns joined plugin-contributed chat-pointer guidance.
 *
 * @returns Multi-line guidance or empty string.
 */
export function getPluginChatPointerGuidance(): string {
  return [...pluginGuidanceByKey.values()].join('\n');
}

/**
 * Clears registry state for unit tests, including plugin guidance.
 */
export function resetChatPointerRegistryForTests(): void {
  pointersById.clear();
  pluginGuidanceByKey.clear();
}
