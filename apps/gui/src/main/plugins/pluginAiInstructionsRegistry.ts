/**
 * Main-process activation map for plugin AI instruction registrations.
 *
 * Wraps core {@link registerPluginAiInstructions} so unload clears dispose handles.
 */

import {
  registerPluginAiInstructions as registerCorePluginAiInstructions,
  clearPluginAiInstructions as clearCorePluginAiInstructions
} from '@harborclient/core/ai/scriptReferences';

/**
 * Dispose handles keyed by `${pluginId}::${registrationId}`.
 */
const disposeByKey = new Map<string, () => void>();

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
 * Registers a plugin AI instruction fragment in the core prompt map.
 *
 * @param pluginId - Owning plugin manifest id.
 * @param registrationId - Agent-scoped registration id.
 * @param text - Instruction text.
 */
export function registerPluginAiInstructionEntry(
  pluginId: string,
  registrationId: string,
  text: string
): void {
  const key = registrationKey(pluginId, registrationId);
  const existing = disposeByKey.get(key);
  existing?.();
  const dispose = registerCorePluginAiInstructions(pluginId, registrationId, text);
  disposeByKey.set(key, dispose);
}

/**
 * Unregisters one plugin AI instruction registration.
 *
 * @param pluginId - Plugin manifest id.
 * @param registrationId - Agent-scoped registration id.
 */
export function unregisterPluginAiInstructionEntry(pluginId: string, registrationId: string): void {
  const key = registrationKey(pluginId, registrationId);
  const dispose = disposeByKey.get(key);
  if (dispose == null) {
    return;
  }
  dispose();
  disposeByKey.delete(key);
}

/**
 * Clears every AI instruction registration owned by one plugin.
 *
 * @param pluginId - Plugin manifest id.
 */
export function clearPluginAiInstructionEntries(pluginId: string): void {
  for (const [key, dispose] of [...disposeByKey.entries()]) {
    if (key.startsWith(`${pluginId}::`)) {
      dispose();
      disposeByKey.delete(key);
    }
  }
  clearCorePluginAiInstructions(pluginId);
}

/**
 * Clears all instruction registrations (unit tests).
 */
export function resetPluginAiInstructionEntriesForTests(): void {
  for (const dispose of disposeByKey.values()) {
    dispose();
  }
  disposeByKey.clear();
}
