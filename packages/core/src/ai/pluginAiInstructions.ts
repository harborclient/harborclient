/**
 * Activation-scoped plugin AI instruction fragments for the agent system prompt.
 *
 * Append-only: plugins cannot rewrite Harbor's base system prompt.
 */

/**
 * One registered instruction fragment.
 */
interface PluginAiInstructionEntry {
  /**
   * Owning plugin manifest id.
   */
  pluginId: string;

  /**
   * Agent-scoped registration id from the bridged plugin context.
   */
  registrationId: string;

  /**
   * Trimmed instruction text.
   */
  text: string;
}

/**
 * Plugin AI instructions keyed by `${pluginId}::${registrationId}`.
 */
const instructionsByKey = new Map<string, PluginAiInstructionEntry>();

/**
 * Builds the map key for one instruction registration.
 *
 * @param pluginId - Plugin manifest id.
 * @param registrationId - Agent-scoped registration id.
 * @returns Stable map key.
 */
function registrationKey(pluginId: string, registrationId: string): string {
  return `${pluginId}::${registrationId}`;
}

/**
 * Registers an activation-scoped instruction fragment for a plugin.
 *
 * Empty or whitespace-only text is ignored (no map entry). Dispose still works.
 *
 * @param pluginId - Owning plugin id.
 * @param registrationId - Opaque registration id from the plugin context.
 * @param text - Static prompt fragment while the plugin is loaded.
 * @returns Dispose function that removes the entry.
 */
export function registerPluginAiInstructions(
  pluginId: string,
  registrationId: string,
  text: string
): () => void {
  const key = registrationKey(pluginId, registrationId);
  const trimmed = text.trim();
  if (trimmed) {
    instructionsByKey.set(key, {
      pluginId,
      registrationId,
      text: trimmed
    });
  }
  return () => {
    instructionsByKey.delete(key);
  };
}

/**
 * Unregisters one instruction registration.
 *
 * @param pluginId - Plugin manifest id.
 * @param registrationId - Agent-scoped registration id.
 */
export function unregisterPluginAiInstructions(pluginId: string, registrationId: string): void {
  instructionsByKey.delete(registrationKey(pluginId, registrationId));
}

/**
 * Clears every instruction registration owned by one plugin.
 *
 * @param pluginId - Plugin manifest id.
 */
export function clearPluginAiInstructions(pluginId: string): void {
  for (const [key, entry] of [...instructionsByKey.entries()]) {
    if (entry.pluginId === pluginId) {
      instructionsByKey.delete(key);
    }
  }
}

/**
 * Returns joined plugin-contributed AI instruction fragments in registration order.
 *
 * @returns Multi-line guidance or empty string.
 */
export function getPluginAiInstructions(): string {
  return [...instructionsByKey.values()].map((entry) => entry.text).join('\n');
}

/**
 * Returns instruction texts for one plugin (for `hc.ai.instructions.list`).
 *
 * @param pluginId - Plugin manifest id.
 * @returns Readonly list of trimmed fragments for that plugin.
 */
export function listPluginAiInstructions(pluginId: string): readonly string[] {
  return [...instructionsByKey.values()]
    .filter((entry) => entry.pluginId === pluginId)
    .map((entry) => entry.text);
}

/**
 * Clears all plugin AI instruction registrations (unit tests).
 */
export function resetPluginAiInstructionsForTests(): void {
  instructionsByKey.clear();
}
