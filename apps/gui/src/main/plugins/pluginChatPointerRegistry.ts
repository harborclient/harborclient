import {
  isValidPluginChatPointerId,
  compilePluginChatPointerMatch,
  normalizePluginChatPointerMatchSource,
  registerPluginChatPointerGuidance
} from '@harborclient/core/ai/scriptReferences';

/**
 * Serialized custom match from the plugin bridge.
 */
export interface PluginChatPointerMatchPayload {
  /**
   * Regex source for the token body after `@`.
   */
  source: string;

  /**
   * RegExp flags without `g`.
   */
  flags?: string;
}

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
   * Pointer id segment (`@plugin.<pluginId>.<pointerId>.…` or custom registration id).
   */
  pointerId: string;

  /**
   * Normalized custom match source when the plugin registered `match` + `parse`.
   */
  matchSource?: string;

  /**
   * Dispose function for core agentGuidance registration (default grammar path).
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
 * Registers a plugin chat pointer and optional agent guidance / custom match.
 *
 * Custom-match pointers put guidance on the renderer dynamic definition instead of
 * the main-process guidance map (avoid duplicates).
 *
 * @param input - Registration payload from the plugin bridge.
 * @returns Void.
 * @throws When pointerId or match is invalid.
 */
export function registerPluginChatPointer(input: {
  pluginId: string;
  registrationId: string;
  pointerId: string;
  agentGuidance?: string;
  match?: PluginChatPointerMatchPayload;
}): void {
  const pointerId = String(input.pointerId ?? '').trim();
  if (!isValidPluginChatPointerId(pointerId)) {
    throw new Error(`Invalid chat pointer id: ${pointerId}`);
  }

  let matchSource: string | undefined;
  if (input.match != null) {
    const flags = String(input.match.flags ?? '').replace(/g/g, '');
    const raw =
      flags !== ''
        ? new RegExp(String(input.match.source ?? ''), flags)
        : String(input.match.source ?? '');
    // Validates compilability + reserved denylist; store normalized source.
    compilePluginChatPointerMatch(raw);
    matchSource = normalizePluginChatPointerMatchSource(raw);
  }

  const key = registrationKey(input.pluginId, input.registrationId);
  const existing = registrations.get(key);
  existing?.disposeGuidance();

  const guidance = input.agentGuidance?.trim() ?? '';
  // Default grammar: guidance lives in the main-process map.
  // Custom match: guidance is attached to the renderer ChatPointerDefinition.
  const disposeGuidance =
    guidance && matchSource == null
      ? registerPluginChatPointerGuidance(input.pluginId, pointerId, guidance)
      : () => undefined;

  registrations.set(key, {
    pluginId: input.pluginId,
    registrationId: input.registrationId,
    pointerId,
    ...(matchSource != null ? { matchSource } : {}),
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
 * Returns a registration by plugin id and registration id.
 *
 * @param pluginId - Plugin manifest id.
 * @param registrationId - Agent-scoped registration id.
 * @returns Registration or undefined.
 */
export function getPluginChatPointerRegistrationById(
  pluginId: string,
  registrationId: string
): PluginChatPointerRegistration | undefined {
  return registrations.get(registrationKey(pluginId, registrationId));
}

/**
 * Returns the first registration for a plugin pointer id, when present.
 *
 * @param pluginId - Plugin manifest id.
 * @param pointerId - Pointer id.
 * @returns Registration or undefined.
 */
export function getPluginChatPointerRegistration(
  pluginId: string,
  pointerId: string
): PluginChatPointerRegistration | undefined {
  for (const entry of registrations.values()) {
    if (entry.pluginId === pluginId && entry.pointerId === pointerId) {
      return entry;
    }
  }
  return undefined;
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
