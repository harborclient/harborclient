import Store from 'electron-store';
import type { AiChatSessionState } from '#/shared/types';

const STORE_KEY = 'aiChatSession';

export const DEFAULT_AI_CHAT_SESSION: AiChatSessionState = {
  openTabIds: [],
  activeChatId: null,
  enterToSend: true
};

let store: Store<{ aiChatSession: AiChatSessionState }> | null = null;

/**
 * Returns the lazy electron-store instance for AI chat session preferences.
 */
function getStore(): Store<{ aiChatSession: AiChatSessionState }> {
  if (!store) {
    store = new Store<{ aiChatSession: AiChatSessionState }>({
      name: 'settings',
      defaults: {
        aiChatSession: DEFAULT_AI_CHAT_SESSION
      }
    });
  }
  return store;
}

/**
 * Normalizes AI chat session from storage or user input.
 *
 * @param input - Partial or raw chat session state.
 * @returns Sanitized chat session with deduped tabs and a valid active id.
 */
function normalizeAiChatSession(input: Partial<AiChatSessionState>): AiChatSessionState {
  const openTabIds = Array.from(
    new Set(
      (input.openTabIds ?? [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );

  const activeCandidate = input.activeChatId == null ? null : Number(input.activeChatId);
  const activeChatId =
    activeCandidate != null &&
    Number.isInteger(activeCandidate) &&
    activeCandidate > 0 &&
    openTabIds.includes(activeCandidate)
      ? activeCandidate
      : (openTabIds[0] ?? null);

  return {
    openTabIds,
    activeChatId,
    enterToSend: input.enterToSend === false ? false : true
  };
}

/**
 * Returns persisted AI chat tab session state.
 */
export function getAiChatSession(): AiChatSessionState {
  const stored = getStore().get(STORE_KEY, DEFAULT_AI_CHAT_SESSION);
  return normalizeAiChatSession(stored ?? DEFAULT_AI_CHAT_SESSION);
}

/**
 * Persists AI chat tab session state.
 *
 * @param state - Chat session snapshot to store.
 */
export function setAiChatSession(state: AiChatSessionState): void {
  getStore().set(STORE_KEY, normalizeAiChatSession(state));
}
