import { Button, FaIcon, Select, fieldFrame } from '@harborclient/sdk/components';
import { useEffect, useRef, useState, type JSX } from 'react';
import { getAvailableModels, resolveAiModelOption } from '#/shared/ai/models';
import type { AiSettings } from '#/shared/types';
import { faArrowUp, faStop } from '#/renderer/src/fontawesome';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  clearSendError,
  selectHubModelGroups,
  selectPendingComposerText,
  selectSendErrorByChat,
  selectEnterToSend,
  setPendingComposerText,
  setSelectedModel
} from '#/renderer/src/store/slices/aiChatSlice';
import { sendChatMessage, cancelChatMessage } from '#/renderer/src/store/thunks/aiChat';
import { ChatComposerTextarea, type ChatComposerTextareaHandle } from './ChatComposerTextarea';

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
  const pendingComposerText = useAppSelector(selectPendingComposerText);
  const enterToSend = useAppSelector(selectEnterToSend);
  const [draft, setDraft] = useState('');
  const composerRef = useRef<ChatComposerTextareaHandle>(null);
  const wasSendingRef = useRef(false);
  const availableModels = getAvailableModels(aiSettings, hubModelGroups);
  const modelId = selectedModel ?? availableModels[0]?.id ?? '';
  const selectedModelOption = resolveAiModelOption(modelId, aiSettings, hubModelGroups);
  const canSend = chatId != null && draft.trim().length > 0 && !sending && modelId.length > 0;
  const sendError = chatId != null ? sendErrorByChat[chatId] : undefined;

  /**
   * Applies one-shot composer text queued by external UI (for example script Ask AI buttons).
   */
  useEffect(() => {
    if (pendingComposerText == null) {
      return;
    }

    const text = pendingComposerText;
    dispatch(setPendingComposerText(null));

    queueMicrotask(() => {
      setDraft(text);
      composerRef.current?.focus();
    });
  }, [dispatch, pendingComposerText]);

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
        model: modelId || undefined,
        hubId: selectedModelOption?.source === 'hub' ? selectedModelOption.hubId : undefined
      })
    );
  };

  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-separator p-3 app-no-drag">
      <div className={`flex flex-col ${fieldFrame}`}>
        <ChatComposerTextarea
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
            className="min-w-0 cursor-pointer truncate border-none bg-transparent py-0 text-[16px] text-muted"
            value={modelId}
            disabled={chatId == null || availableModels.length === 0}
            aria-label="AI model"
            onChange={(event) => {
              if (chatId == null) return;
              dispatch(setSelectedModel({ chatId, modelId: event.target.value }));
            }}
          >
            {availableModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            variant={sending || canSend ? 'primary' : 'secondary'}
            className="size-8 shrink-0 p-0"
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
