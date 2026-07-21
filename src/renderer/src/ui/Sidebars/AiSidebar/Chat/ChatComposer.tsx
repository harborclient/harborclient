import { Button, FaIcon, Select, fieldFrame } from '@harborclient/sdk/components';
import { useEffect, useRef, useState, type JSX } from 'react';
import {
  getAvailableModels,
  getAiModelOptionGroupLabel,
  resolveAiModelOption
} from '#/shared/ai/models';
import type { AiSettings } from '#/shared/types';
import { faArrowUp, faStop } from '#/renderer/src/fontawesome';
import { AiModelSelectOptions } from '#/renderer/src/ui/Shared/AiModelSelectOptions';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  clearComposerFocus,
  clearSendError,
  selectChatHistory,
  selectGithubModelsConnected,
  selectHubModelGroups,
  selectPendingComposerFocusChatId,
  selectPendingComposerText,
  selectSendErrorByChat,
  selectEnterToSend,
  setPendingComposerText,
  setSelectedModel
} from '#/renderer/src/store/slices/aiChatSlice';
import { sendChatMessage, cancelChatMessage } from '#/renderer/src/store/thunks/aiChat';
import { ChatComposerTextarea, type ChatComposerTextareaHandle } from './ChatComposerTextarea';
import { runWhenComposerReady } from './focusAiChatComposer';

interface Props {
  /**
   * Active chat id for sends, if any.
   */
  chatId: number | null;

  /**
   * AI provider settings for model availability.
   */
  aiSettings: AiSettings;

  /**
   * Currently selected model id for the active chat.
   */
  selectedModel?: string;

  /**
   * Whether a message send is in progress.
   */
  sending: boolean;
}

/**
 * Prompt input, model picker, and send button for the active chat.
 */
export function ChatComposer({ chatId, aiSettings, selectedModel, sending }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const sendErrorByChat = useAppSelector(selectSendErrorByChat);
  const hubModelGroups = useAppSelector(selectHubModelGroups);
  const githubConnected = useAppSelector(selectGithubModelsConnected);
  const pendingComposerText = useAppSelector(selectPendingComposerText);
  const pendingComposerFocusChatId = useAppSelector(selectPendingComposerFocusChatId);
  const chatHistory = useAppSelector(selectChatHistory);
  const enterToSend = useAppSelector(selectEnterToSend);
  const [draft, setDraft] = useState('');
  const [composerAnnouncement, setComposerAnnouncement] = useState('');
  const composerRef = useRef<ChatComposerTextareaHandle>(null);
  const wasSendingRef = useRef(false);
  const availableModels = getAvailableModels(aiSettings, hubModelGroups, githubConnected);
  const modelId = selectedModel ?? availableModels[0]?.value ?? '';
  const selectedModelOption = resolveAiModelOption(
    modelId,
    aiSettings,
    hubModelGroups,
    githubConnected
  );
  const canSend = chatId != null && draft.trim().length > 0 && !sending && modelId.length > 0;
  const sendError = chatId != null ? sendErrorByChat[chatId] : undefined;

  /**
   * Applies one-shot composer text queued by external UI (for example script Ask AI buttons).
   *
   * Takes priority over a plain composer-focus request so caret placement from
   * `setTextAndFocusEnd` / `appendReferenceAtEnd` is preserved.
   */
  useEffect(() => {
    if (pendingComposerText == null) {
      return;
    }

    const text = pendingComposerText;
    dispatch(setPendingComposerText(null));
    dispatch(clearComposerFocus());

    /**
     * Retries applying pending text until the CodeMirror view is mounted.
     *
     * @param attempt - Zero-based retry count.
     */
    const applyPendingText = (attempt = 0): void => {
      let applied = false;
      if (draft.trim().length > 0) {
        const separator = /\s$/.test(draft) ? '' : ' ';
        const nextDraft = `${draft}${separator}${text}`;
        setDraft(nextDraft);
        applied = composerRef.current?.appendReferenceAtEnd(text) ?? false;
        if (applied) {
          return;
        }
      } else {
        setDraft(text);
        applied = composerRef.current?.setTextAndFocusEnd(text) ?? false;
        if (applied) {
          return;
        }
      }

      if (attempt < 8) {
        requestAnimationFrame(() => {
          applyPendingText(attempt + 1);
        });
      }
    };

    queueMicrotask(() => {
      applyPendingText();
    });
  }, [dispatch, draft, pendingComposerText]);

  /**
   * Focuses the composer after a new chat is created when no pending text is queued.
   *
   * Only runs when the pending focus chat id matches the active chat, so closing the new
   * tab before focus lands does not steal focus onto a neighbor. Announces for screen readers.
   */
  useEffect(() => {
    if (
      pendingComposerFocusChatId == null ||
      chatId == null ||
      pendingComposerFocusChatId !== chatId ||
      pendingComposerText != null
    ) {
      if (
        pendingComposerFocusChatId != null &&
        chatId != null &&
        pendingComposerFocusChatId !== chatId
      ) {
        dispatch(clearComposerFocus());
      }
      return;
    }

    const chatTitle = chatHistory.find((chat) => chat.id === chatId)?.title ?? null;
    const announcement =
      chatTitle != null && chatTitle.length > 0
        ? `New chat opened: ${chatTitle}`
        : 'New chat opened';

    dispatch(clearComposerFocus());

    /**
     * Defers the live-region update so React does not treat it as a synchronous
     * setState cascade inside this effect.
     */
    queueMicrotask(() => {
      setComposerAnnouncement(announcement);
    });

    runWhenComposerReady(() => {
      if (composerRef.current == null) {
        return false;
      }

      composerRef.current.focus();
      return true;
    });
  }, [chatHistory, chatId, dispatch, pendingComposerFocusChatId, pendingComposerText]);

  /**
   * Clears the screen-reader announcement after it has been exposed so repeated new chats
   * re-announce.
   */
  useEffect(() => {
    if (composerAnnouncement.length === 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setComposerAnnouncement('');
    }, 1000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [composerAnnouncement]);

  /**
   * Returns focus to the prompt after a send completes and the editor is re-enabled.
   */
  useEffect(() => {
    if (wasSendingRef.current && !sending) {
      composerRef.current?.focus();
    }
    wasSendingRef.current = sending;
  }, [sending]);

  /**
   * Dispatches the cancel thunk to stop the in-flight AI reply.
   */
  const handleStop = (): void => {
    if (chatId == null || !sending) return;
    void dispatch(cancelChatMessage(chatId));
  };

  /**
   * Dispatches the send thunk and clears the draft input.
   */
  const handleSend = async (): Promise<void> => {
    if (chatId == null || !canSend) return;

    const content = draft.trim();
    setDraft('');
    dispatch(clearSendError(chatId));
    await dispatch(
      sendChatMessage({
        chatId,
        content,
        model: selectedModelOption?.id ?? modelId ?? undefined,
        hubId: selectedModelOption?.source === 'hub' ? selectedModelOption.hubId : undefined
      })
    );
  };

  return (
    <div className="flex shrink-0 flex-col gap-2 p-3 app-no-drag">
      <p role="status" aria-live="polite" className="sr-only">
        {composerAnnouncement}
      </p>
      <div className={`flex flex-col ${fieldFrame} rounded-2xl!`}>
        <ChatComposerTextarea
          key={chatId ?? 'no-chat'}
          ref={composerRef}
          embedded
          value={draft}
          placeholder="Type a message…"
          aria-label="Chat message"
          disabled={chatId == null || sending}
          enterToSend={enterToSend}
          canSubmit={canSend}
          onChange={(nextValue) => {
            setDraft(nextValue);
            if (chatId != null) {
              dispatch(clearSendError(chatId));
            }
          }}
          onSubmit={() => {
            void handleSend();
          }}
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-0">
          <Select
            id="ai-chat-model"
            variant="plain"
            className="min-w-0 cursor-pointer truncate border-none bg-transparent py-0 text-muted"
            value={modelId}
            disabled={chatId == null || availableModels.length === 0}
            aria-label={
              selectedModelOption != null
                ? `AI model, ${selectedModelOption.label}, ${getAiModelOptionGroupLabel(selectedModelOption)}`
                : 'AI model'
            }
            onChange={(event) => {
              if (chatId == null) return;
              dispatch(setSelectedModel({ chatId, modelId: event.target.value }));
            }}
          >
            <AiModelSelectOptions models={availableModels} />
          </Select>
          <Button
            type="button"
            variant={sending || canSend ? 'primary' : 'secondary'}
            className="h-[32px] w-[32px] min-h-[32px] min-w-[32px] max-h-[32px] max-w-[32px] shrink-0 p-0"
            disabled={sending ? false : !canSend}
            aria-label={sending ? 'Stop generating' : 'Send message'}
            onClick={() => (sending ? handleStop() : void handleSend())}
          >
            <FaIcon icon={sending ? faStop : faArrowUp} className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      </div>
      {sendError ? (
        <p className="text-[14px] text-danger" role="alert">
          {sendError}
        </p>
      ) : null}
    </div>
  );
}
