import {
  buildPluginChatPointerToken,
  compilePluginChatPointerMatch,
  type PluginChatPointerSnapshot
} from '@harborclient/core/ai/scriptReferences';
import { store } from '#/renderer/src/store/redux';
import {
  selectActiveChatId,
  setPendingComposerText
} from '#/renderer/src/store/slices/aiChatSlice';
import { setShowAiSidebar } from '#/renderer/src/store/slices/navigationSlice';
import { setPluginSelection } from '#/renderer/src/store/slices/pluginSelectionsSlice';
import { createNewChat } from '#/renderer/src/store/thunks/aiChat';
import {
  getTrackedPluginChatPointer,
  isTrackedPluginChatPointer
} from '#/renderer/src/plugins/pluginChatPointerTracker';
import { DEFAULT_AI_SETTINGS } from '#/renderer/src/ui/Tabs/Settings/constants';

/**
 * Maximum characters of plugin context inlined into the AI system message.
 */
export const PLUGIN_CHAT_POINTER_MAX_CONTEXT_CHARS = 100_000;

/**
 * Truncates plugin context for chat expansion and marks the truncation.
 *
 * @param context - Raw context text from the plugin.
 * @returns Possibly truncated context string.
 */
export function truncatePluginChatPointerContext(context: string): string {
  if (context.length <= PLUGIN_CHAT_POINTER_MAX_CONTEXT_CHARS) {
    return context;
  }

  return `${context.slice(0, PLUGIN_CHAT_POINTER_MAX_CONTEXT_CHARS)}\n\n…[truncated plugin context]`;
}

/**
 * Rebuilds a RegExpMatchArray-like groups list from a body match for IPC parse.
 *
 * @param bodyMatch - Successful match against the custom pointer regex.
 * @returns Serializable capture groups including index 0.
 */
function matchGroupsFromBody(bodyMatch: RegExpMatchArray): Array<string | null> {
  const groups: Array<string | null> = [];
  for (let i = 0; i < bodyMatch.length; i += 1) {
    groups[i] = bodyMatch[i] ?? null;
  }
  return groups;
}

/**
 * Opens the AI sidebar and queues a plugin `@` chat-pointer token with a snapshot.
 *
 * @param pluginId - Owning plugin manifest id.
 * @param input - Pointer id, key/token, label, context, and optional selection.
 */
export async function copyPluginPointerToChat(
  pluginId: string,
  input: {
    pointerId: string;
    key?: string;
    token?: string;
    label: string;
    context: string;
    selection?: { start: number; end: number };
  }
): Promise<void> {
  const pointerId = String(input.pointerId ?? '').trim();
  const label = String(input.label ?? '').trim() || pointerId;

  if (!isTrackedPluginChatPointer(pluginId, pointerId)) {
    throw new Error(`Chat pointer "${pointerId}" is not registered for plugin ${pluginId}.`);
  }

  const tracked = getTrackedPluginChatPointer(pluginId, pointerId);
  let token: string;
  let selection = input.selection;

  if (tracked?.matchSource != null) {
    const rawToken = String(input.token ?? '').trim();
    if (!rawToken.startsWith('@')) {
      throw new Error('Custom chat pointer copyToChat requires a token starting with "@".');
    }
    const body = rawToken.slice(1);
    const compiled = compilePluginChatPointerMatch(tracked.matchSource);
    const bodyMatch = body.match(compiled);
    if (bodyMatch == null || bodyMatch.index !== 0) {
      throw new Error(`Token does not match registered chat pointer "${pointerId}".`);
    }
    token = `@${bodyMatch[0]}`;

    try {
      const parsed = (await window.api.invokePluginParseChatPointer(
        pluginId,
        tracked.registrationId,
        {
          matchGroups: matchGroupsFromBody(bodyMatch),
          fullToken: token,
          atIndex: 0
        }
      )) as { key?: string; selection?: { start: number; end: number } } | null;
      if (parsed == null) {
        throw new Error(`Chat pointer parse rejected token for "${pointerId}".`);
      }
      if (parsed.selection != null) {
        selection = parsed.selection;
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('parse rejected')) {
        throw error;
      }
      // Agent unavailable or parse error — keep host selection / snapshot as provided.
    }
  } else {
    const key = String(input.key ?? '').trim();
    if (!key) {
      throw new Error('Chat pointer copyToChat requires a key for the default @plugin grammar.');
    }
    token = buildPluginChatPointerToken(pluginId, pointerId, key, input.selection);
  }

  const snapshot: PluginChatPointerSnapshot = {
    pluginId,
    pointerId,
    label,
    context: truncatePluginChatPointerContext(String(input.context ?? '')),
    ...(selection != null ? { selection } : {})
  };

  store.dispatch(setPluginSelection({ token, snapshot }));
  store.dispatch(setShowAiSidebar(true));

  if (selectActiveChatId(store.getState()) == null) {
    const aiSettings = (await window.api.getAiSettings()) ?? DEFAULT_AI_SETTINGS;
    await store.dispatch(createNewChat(aiSettings));
  }

  store.dispatch(setPendingComposerText(token));
}
