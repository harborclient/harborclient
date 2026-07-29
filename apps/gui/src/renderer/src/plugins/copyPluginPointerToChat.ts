import {
  buildPluginChatPointerToken,
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
import { isTrackedPluginChatPointer } from '#/renderer/src/plugins/pluginChatPointerTracker';
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
 * Opens the AI sidebar and queues a plugin `@` chat-pointer token with a snapshot.
 *
 * @param pluginId - Owning plugin manifest id.
 * @param input - Pointer id, key, label, context, and optional selection.
 */
export async function copyPluginPointerToChat(
  pluginId: string,
  input: {
    pointerId: string;
    key: string;
    label: string;
    context: string;
    selection?: { start: number; end: number };
  }
): Promise<void> {
  const pointerId = String(input.pointerId ?? '').trim();
  const key = String(input.key ?? '').trim();
  const label = String(input.label ?? '').trim() || pointerId;

  if (!isTrackedPluginChatPointer(pluginId, pointerId)) {
    throw new Error(`Chat pointer "${pointerId}" is not registered for plugin ${pluginId}.`);
  }

  const token = buildPluginChatPointerToken(pluginId, pointerId, key, input.selection);
  const snapshot: PluginChatPointerSnapshot = {
    pluginId,
    pointerId,
    label,
    context: truncatePluginChatPointerContext(String(input.context ?? '')),
    ...(input.selection != null ? { selection: input.selection } : {})
  };

  store.dispatch(setPluginSelection({ token, snapshot }));
  store.dispatch(setShowAiSidebar(true));

  if (selectActiveChatId(store.getState()) == null) {
    const aiSettings = (await window.api.getAiSettings()) ?? DEFAULT_AI_SETTINGS;
    await store.dispatch(createNewChat(aiSettings));
  }

  store.dispatch(setPendingComposerText(token));
}
