import {
  isValidPluginChatPointerId,
  registerPluginChatPointerGuidance
} from '@harborclient/core/ai/scriptReferences';

/**
 * One activation-scoped plugin chat-pointer registration.
 */
export interface PluginChatPointerRegistration {
  /**
   * Owning plugin manifest id.
   */
  pluginId: string;

  /**
   * Agent-scoped registration id from the bridged plugin context.
   */
  registrationId: string;

  /**
   * Pointer id segment (`@plugin.<pluginId>.<pointerId>.…`).
   */
  pointerId: string;

  /**
   * Dispose function for core agentGuidance registration.
   */
  disposeGuidance: () => void;
}

const registrations = new Map<string, PluginChatPointerRegistration>();

/**
 * Builds the map key for one plugin chat-pointer registration.
 *
 * @param pluginId - Plugin manifest id.
 * @param registrationId - Agent-scoped registration id.
 * @returns Stable map key.
 */
function registrationKey(pluginId: string, registrationId: string): string {
  return `${pluginId}::${registrationId}`;
}

/**
 * Registers a plugin chat pointer and optional agent guidance.
 *
 * @param input - Registration payload from the plugin bridge.
 * @returns Void.
 * @throws When pointerId is invalid.
 */
export function registerPluginChatPointer(input: {
  pluginId: string;
  registrationId: string;
  pointerId: string;
  agentGuidance?: string;
}): void {
  const pointerId = String(input.pointerId ?? '').trim();
  if (!isValidPluginChatPointerId(pointerId)) {
    throw new Error(`Invalid chat pointer id: ${pointerId}`);
  }

  const key = registrationKey(input.pluginId, input.registrationId);
  const existing = registrations.get(key);
  existing?.disposeGuidance();

  const guidance = input.agentGuidance?.trim() ?? '';
  const disposeGuidance = guidance
    ? registerPluginChatPointerGuidance(input.pluginId, pointerId, guidance)
    : () => undefined;

  registrations.set(key, {
    pluginId: input.pluginId,
    registrationId: input.registrationId,
    pointerId,
    disposeGuidance
  });
}

/**
 * Unregisters one plugin chat-pointer registration.
 *
 * @param pluginId - Plugin manifest id.
 * @param registrationId - Agent-scoped registration id.
 */
export function unregisterPluginChatPointer(pluginId: string, registrationId: string): void {
  const key = registrationKey(pluginId, registrationId);
  const existing = registrations.get(key);
  if (existing == null) {
    return;
  }
  existing.disposeGuidance();
  registrations.delete(key);
}

/**
 * Clears every chat-pointer registration owned by one plugin.
 *
 * @param pluginId - Plugin manifest id.
 */
export function clearPluginChatPointers(pluginId: string): void {
  for (const [key, entry] of [...registrations.entries()]) {
    if (entry.pluginId === pluginId) {
      entry.disposeGuidance();
      registrations.delete(key);
    }
  }
}

/**
 * Returns whether a plugin has registered the given pointer id.
 *
 * @param pluginId - Plugin manifest id.
 * @param pointerId - Pointer id segment.
 * @returns True when at least one active registration matches.
 */
export function isPluginChatPointerRegistered(pluginId: string, pointerId: string): boolean {
  for (const entry of registrations.values()) {
    if (entry.pluginId === pluginId && entry.pointerId === pointerId) {
      return true;
    }
  }
  return false;
}

/**
 * Clears all registrations (unit tests).
 */
export function resetPluginChatPointerRegistryForTests(): void {
  for (const entry of registrations.values()) {
    entry.disposeGuidance();
  }
  registrations.clear();
}
