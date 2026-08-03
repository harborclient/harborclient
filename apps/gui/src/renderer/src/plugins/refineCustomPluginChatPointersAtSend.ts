/**
 * Send-time re-validation of custom plugin chat pointers via plugin `parse`.
 */

import {
  findAiScriptReferenceCandidates,
  compilePluginChatPointerMatch
} from '@harborclient/core/ai/scriptReferences';
import { getTrackedPluginChatPointer } from '#/renderer/src/plugins/pluginChatPointerTracker';
import { store } from '#/renderer/src/store/redux';
import {
  clearPluginSelection,
  selectPluginSelections
} from '#/renderer/src/store/slices/pluginSelectionsSlice';

/**
 * Rebuilds capture groups for IPC parse from a body match.
 *
 * @param bodyMatch - Regex match against the token body.
 * @returns Serializable groups including index 0.
 */
function matchGroupsFromBody(bodyMatch: RegExpMatchArray): Array<string | null> {
  const groups: Array<string | null> = [];
  for (let i = 0; i < bodyMatch.length; i += 1) {
    groups[i] = bodyMatch[i] ?? null;
  }
  return groups;
}

/**
 * Re-invokes plugin `parse` for custom chat pointers in a message.
 *
 * When parse returns null, the snapshot for that token is cleared so send-time
 * validation/expansion drops it. Host fallback parse still drives typing/highlight.
 *
 * @param text - User message text that may contain `@` tokens.
 */
export async function refineCustomPluginChatPointersAtSend(text: string): Promise<void> {
  const candidates = findAiScriptReferenceCandidates(text);
  const snapshots = selectPluginSelections(store.getState());

  for (const reference of candidates) {
    if (reference.kind !== 'plugin') {
      continue;
    }
    const tracked = getTrackedPluginChatPointer(reference.pluginId, reference.pointerId);
    if (tracked?.matchSource == null) {
      continue;
    }
    if (snapshots[reference.text] == null) {
      continue;
    }

    const body = reference.text.slice(1);
    const compiled = compilePluginChatPointerMatch(tracked.matchSource);
    const bodyMatch = body.match(compiled);
    if (bodyMatch == null || bodyMatch.index !== 0) {
      continue;
    }

    try {
      const parsed = await window.api.invokePluginParseChatPointer(
        reference.pluginId,
        tracked.registrationId,
        {
          matchGroups: matchGroupsFromBody(bodyMatch),
          fullToken: reference.text,
          atIndex: reference.start
        }
      );
      if (parsed == null) {
        store.dispatch(clearPluginSelection({ token: reference.text }));
      }
    } catch {
      // Keep host fallback / existing snapshot when the agent is unavailable.
    }
  }
}
