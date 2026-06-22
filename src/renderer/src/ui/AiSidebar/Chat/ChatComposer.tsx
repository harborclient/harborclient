import { useEffect, useRef, useState, type JSX, type KeyboardEvent } from 'react';
import { getAvailableModels } from '#/shared/aiModels';
import type { AiSettings } from '#/shared/types';
import { Button } from '#/renderer/src/components/Button';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  clearSendError,
  selectSendErrorByChat,
  setSelectedModel
} from '#/renderer/src/store/slices/aiChatSlice';
import { sendChatMessage } from '#/renderer/src/store/thunks/aiChat';
import { field } from '#/renderer/src/ui/shared/classes';

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
  const [draft, setDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wasSendingRef = useRef(false);
  const availableModels = getAvailableModels(aiSettings);
  const modelId = selectedModel ?? availableModels[0]?.id ?? '';
  const canSend = chatId != null && draft.trim().length > 0 && !sending && modelId.length > 0;
  const sendError = chatId != null ? sendErrorByChat[chatId] : undefined;

  /**
   * Returns focus to the prompt after a send completes and the textarea is re-enabled.
   */
  useEffect(() => {
    if (wasSendingRef.current && !sending) {
      textareaRef.current?.focus();
    }
    wasSendingRef.current = sending;
  }, [sending]);

  /**
   * Sends the current draft when Enter is pressed without Shift.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey && canSend) {
      event.preventDefault();
      void handleSend();
    }
  };

  /**
   * Dispatches the send thunk and clears the draft input.
   */
  const handleSend = async (): Promise<void> => {
    if (chatId == null || !canSend) return;

    const content = draft.trim();
    setDraft('');
    if (chatId != null) {
      dispatch(clearSendError(chatId));
    }
    await dispatch(
      sendChatMessage({
        chatId,
        content,
        model: modelId || undefined
      })
    );
  };

  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-separator p-3 app-no-drag">
      <textarea
        ref={textareaRef}
        className={`${field} min-h-[72px] w-full resize-none text-[14px]`}
        value={draft}
        placeholder="Type a message…"
        aria-label="Chat message"
        disabled={chatId == null || sending}
        onChange={(event) => {
          setDraft(event.target.value);
          if (chatId != null) {
            dispatch(clearSendError(chatId));
          }
        }}
        onKeyDown={handleKeyDown}
      />
      <div className="flex items-center justify-between gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2" htmlFor="ai-chat-model">
          <span className="shrink-0 text-[13px] text-muted">Model</span>
          <select
            id="ai-chat-model"
            className={`${field} min-w-0 flex-1 cursor-pointer py-1 text-[14px]`}
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
          </select>
        </label>
        <Button type="button" disabled={!canSend} onClick={() => void handleSend()}>
          Send
        </Button>
      </div>
      {sendError ? (
        <p className="text-[13px] text-danger" role="alert">
          {sendError}
        </p>
      ) : null}
    </div>
  );
}
