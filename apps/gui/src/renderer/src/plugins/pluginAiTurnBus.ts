import type { PluginAiAfterTurnContext, PluginAiBeforeTurnContext } from '@harborclient/sdk';
import type { Disposable } from '@harborclient/core/plugin/types';

/**
 * Merged patch from before-turn handlers.
 */
export interface PluginAiBeforeTurnResult {
  /**
   * When true, the host aborts the turn before any LLM call.
   */
  cancelled: boolean;

  /**
   * Optional user-facing cancel reason.
   */
  cancelReason?: string;

  /**
   * Rewritten model-facing user message content (last writer wins).
   */
  userContent?: string;

  /**
   * Turn-scoped instruction fragments to inject as an ephemeral system message.
   */
  extraInstructions: string[];
}

/**
 * Serializable input for before-turn orchestration.
 */
export interface PluginAiBeforeTurnInput {
  chatId: number;
  model: string;
  hubId?: string;
  userMessage: {
    content: string;
    referenceSnapshots?: Record<string, unknown>;
  };
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content?: string | null;
  }>;
}

type BeforeTurnHandler = (ctx: PluginAiBeforeTurnContext) => void | Promise<void>;
type AfterTurnHandler = (ctx: PluginAiAfterTurnContext) => void | Promise<void>;

const beforeTurnHandlers = new Set<BeforeTurnHandler>();
const afterTurnHandlers = new Set<AfterTurnHandler>();

/**
 * Runs host-renderer before-turn handlers, then agent webview handlers via IPC.
 *
 * @param input - Turn context snapshot from `sendChatMessage`.
 * @returns Merged cancel / userContent / extraInstructions patch.
 */
export async function runPluginAiBeforeTurn(
  input: PluginAiBeforeTurnInput
): Promise<PluginAiBeforeTurnResult> {
  const extraInstructions: string[] = [];
  let cancelled = false;
  let cancelReason: string | undefined;
  const userMessage = {
    content: input.userMessage.content,
    ...(input.userMessage.referenceSnapshots != null
      ? { referenceSnapshots: input.userMessage.referenceSnapshots }
      : {})
  };
  const messages = input.messages.map((row) => ({
    role: row.role,
    content: row.content ?? null
  }));

  const ctx: PluginAiBeforeTurnContext = {
    chatId: input.chatId,
    model: input.model,
    ...(input.hubId != null ? { hubId: input.hubId } : {}),
    userMessage,
    instructions: {
      push: (text) => {
        const trimmed = String(text ?? '').trim();
        if (trimmed) {
          extraInstructions.push(trimmed);
        }
      },
      get list() {
        return [...extraInstructions];
      }
    },
    messages,
    cancel: (reason) => {
      cancelled = true;
      if (reason != null && String(reason).trim() !== '') {
        cancelReason = String(reason).trim();
      }
    }
  };

  for (const handler of [...beforeTurnHandlers]) {
    try {
      await handler(ctx);
    } catch (error) {
      console.error('Plugin renderer AI before-turn handler failed:', error);
    }
    if (cancelled) {
      break;
    }
  }

  const local: PluginAiBeforeTurnResult = {
    cancelled,
    ...(cancelReason != null ? { cancelReason } : {}),
    userContent: ctx.userMessage.content,
    extraInstructions: [...extraInstructions]
  };

  if (local.cancelled) {
    return local;
  }

  const remote = await window.api.runPluginAiBeforeTurn({
    chatId: input.chatId,
    model: input.model,
    ...(input.hubId != null ? { hubId: input.hubId } : {}),
    userMessage: {
      content: local.userContent ?? input.userMessage.content,
      ...(input.userMessage.referenceSnapshots != null
        ? { referenceSnapshots: input.userMessage.referenceSnapshots }
        : {})
    },
    messages
  });

  return mergeBeforeTurnResults(local, remote);
}

/**
 * Merges local and remote before-turn patches.
 *
 * @param local - Host-renderer handler result.
 * @param remote - Agent webview broker result.
 * @returns Combined patch.
 */
function mergeBeforeTurnResults(
  local: PluginAiBeforeTurnResult,
  remote: PluginAiBeforeTurnResult
): PluginAiBeforeTurnResult {
  if (remote.cancelled) {
    return {
      cancelled: true,
      ...(remote.cancelReason != null ? { cancelReason: remote.cancelReason } : {}),
      extraInstructions: [...local.extraInstructions, ...remote.extraInstructions],
      ...(remote.userContent != null
        ? { userContent: remote.userContent }
        : local.userContent != null
          ? { userContent: local.userContent }
          : {})
    };
  }

  return {
    cancelled: false,
    extraInstructions: [...local.extraInstructions, ...remote.extraInstructions],
    userContent:
      remote.userContent != null && remote.userContent !== ''
        ? remote.userContent
        : local.userContent
  };
}

/**
 * Notifies renderer-side and agent-plugin after-turn subscribers.
 *
 * @param ctx - Completed turn result.
 */
export function emitPluginAiAfterTurn(ctx: PluginAiAfterTurnContext): void {
  for (const handler of afterTurnHandlers) {
    void Promise.resolve(handler(ctx)).catch((error) => {
      console.error('Plugin renderer AI after-turn handler failed:', error);
    });
  }
  void window.api.pushPluginAiAfterTurn(ctx);
}

/**
 * Subscribes to AI before-turn hooks in the host renderer.
 *
 * @param handler - Called with a mutable turn context.
 * @returns A disposable that removes the listener when disposed.
 */
export function subscribePluginAiBeforeTurn(handler: BeforeTurnHandler): Disposable {
  beforeTurnHandlers.add(handler);
  return {
    dispose: () => {
      beforeTurnHandlers.delete(handler);
    }
  };
}

/**
 * Subscribes to AI after-turn hooks in the host renderer.
 *
 * @param handler - Called with a read-only turn result.
 * @returns A disposable that removes the listener when disposed.
 */
export function subscribePluginAiAfterTurn(handler: AfterTurnHandler): Disposable {
  afterTurnHandlers.add(handler);
  return {
    dispose: () => {
      afterTurnHandlers.delete(handler);
    }
  };
}

/**
 * Clears all AI turn subscribers. Used in tests.
 */
export function clearPluginAiTurnSubscribers(): void {
  beforeTurnHandlers.clear();
  afterTurnHandlers.clear();
}
