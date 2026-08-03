/**
 * Dynamic chat-pointer definitions for plugins that supply a custom `match`.
 */

import type { ChatPointerDefinition, ParsedAiScriptReference } from './types.js';
import { parseSelectionSuffix } from './shared.js';
import {
  buildCustomPluginChatPointerDefinitionId,
  compilePluginChatPointerMatch
} from './pluginMatch.js';
import { registerChatPointer, unregisterChatPointer, getChatPointer } from './registry.js';

/**
 * Shared validate/name/label/expand/snapshot handlers bound from scriptReferences.
 */
export type CustomPluginChatPointerHandlers = Pick<
  ChatPointerDefinition,
  'validate' | 'resolveName' | 'resolveLabel' | 'expandContext' | 'collectSnapshot'
>;

/**
 * Bound handlers used when registering custom plugin pointer definitions.
 *
 * Set once from scriptReferences after builtins bind their handlers.
 */
let customPluginChatPointerHandlers: CustomPluginChatPointerHandlers | null = null;

/**
 * Stores the shared plugin pointer handlers for later dynamic registrations.
 *
 * @param handlers - Same handlers bound onto builtin definitions.
 */
export function setCustomPluginChatPointerHandlers(
  handlers: CustomPluginChatPointerHandlers
): void {
  customPluginChatPointerHandlers = handlers;
}

/**
 * Returns the bound handlers, or throws when scriptReferences has not initialized.
 *
 * @returns Shared handlers for plugin pointer definitions.
 * @throws When handlers have not been bound yet.
 */
function requireCustomPluginChatPointerHandlers(): CustomPluginChatPointerHandlers {
  if (customPluginChatPointerHandlers == null) {
    throw new Error('Custom plugin chat-pointer handlers are not bound yet.');
  }
  return customPluginChatPointerHandlers;
}

/**
 * Host-side sync parse for custom plugin pointers (CodeMirror / candidate scan).
 *
 * Uses capture group 1 as `key` (or the full body when absent) and groups 2–3 as
 * an optional `#start.end` selection. Plugin `parse` over IPC is authoritative at
 * send/validate.
 *
 * @param pluginId - Owning plugin id.
 * @param pointerId - Registered pointer id.
 * @returns Parse function compatible with {@link ChatPointerDefinition.parse}.
 */
export function createHostFallbackPluginParse(
  pluginId: string,
  pointerId: string
): ChatPointerDefinition['parse'] {
  return (match, fullToken, atIndex) => {
    const keyRaw = match[1] != null && match[1] !== '' ? match[1] : match[0];
    if (keyRaw == null || keyRaw === '') {
      return null;
    }

    return {
      kind: 'plugin',
      pluginId,
      pointerId,
      key: String(keyRaw),
      start: atIndex,
      end: atIndex + fullToken.length,
      text: fullToken,
      selection: parseSelectionSuffix(match[2], match[3])
    } satisfies Extract<ParsedAiScriptReference, { kind: 'plugin' }>;
  };
}

/**
 * Registers (or replaces) a dynamic chat-pointer definition for a custom plugin match.
 *
 * @param input - Plugin id, pointer id, compiled/source match, and optional guidance.
 * @returns The registry definition id.
 * @throws When match is invalid/reserved or handlers are unbound.
 */
export function registerCustomPluginChatPointerDefinition(input: {
  pluginId: string;
  pointerId: string;
  match: RegExp | string;
  agentGuidance?: string;
}): string {
  const handlers = requireCustomPluginChatPointerHandlers();
  const compiled = compilePluginChatPointerMatch(input.match);
  const definitionId = buildCustomPluginChatPointerDefinitionId(input.pluginId, input.pointerId);

  if (getChatPointer(definitionId) != null) {
    unregisterChatPointer(definitionId);
  }

  const guidance = input.agentGuidance?.trim() ?? '';
  registerChatPointer({
    id: definitionId,
    match: compiled,
    parse: createHostFallbackPluginParse(input.pluginId, input.pointerId),
    ...(guidance ? { agentGuidance: guidance } : {}),
    validate: handlers.validate,
    resolveName: handlers.resolveName,
    resolveLabel: handlers.resolveLabel,
    expandContext: handlers.expandContext,
    collectSnapshot: handlers.collectSnapshot
  });

  return definitionId;
}

/**
 * Unregisters a custom plugin chat-pointer definition when present.
 *
 * @param pluginId - Owning plugin id.
 * @param pointerId - Pointer id.
 */
export function unregisterCustomPluginChatPointerDefinition(
  pluginId: string,
  pointerId: string
): void {
  const definitionId = buildCustomPluginChatPointerDefinitionId(pluginId, pointerId);
  if (getChatPointer(definitionId) != null) {
    unregisterChatPointer(definitionId);
  }
}
