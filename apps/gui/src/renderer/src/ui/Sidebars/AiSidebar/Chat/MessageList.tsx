import { Scrollbars } from '#/renderer/src/ui/Shared/Scrollbars';
import { EmptyState, FaIcon } from '@harborclient/sdk/components';
import { useCallback, useEffect, useMemo, useRef, type JSX } from 'react';
import type { ChatMessage } from '@harborclient/core/types';
import { faComment } from '#/renderer/src/fontawesome';
import { useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectActiveTurnForChat,
  selectHandoffPresentationForChat
} from '#/renderer/src/store/slices/aiChatSlice';
import { ActiveTurnPresentation } from './ActiveTurnPresentation';
import { buildActiveTurnPresentationProps } from './activeTurnPresentationModel';
import { buildLiveTurnScrollSnapshot, liveTurnScrollKey } from './liveTurnScrollKey';
import { MessageBubble } from './MessageBubble';

interface Props {
  /**
   * Chat id for the active tab.
   */
  chatId: number;

  /**
   * Messages for the active chat.
   */
  messages: ChatMessage[];

  /**
   * Whether a reply is being generated for the active chat.
   */
  sending: boolean;
}

/**
 * Scrollable list of chat messages for the active tab.
 *
 * @param props - Chat id, messages, and in-flight send flag.
 * @returns Scrollable message list or empty state.
 */
export function MessageList({ chatId, messages, sending }: Props): JSX.Element {
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeTurn = useAppSelector(selectActiveTurnForChat(chatId));
  const handoffPresentation = useAppSelector(selectHandoffPresentationForChat(chatId));

  /**
   * Derives live turn presentation props from active turn or handoff state.
   */
  const livePresentation = useMemo(
    () => buildActiveTurnPresentationProps(activeTurn, handoffPresentation),
    [activeTurn, handoffPresentation]
  );

  /**
   * Builds a scroll dependency key from meaningful live turn changes.
   */
  const liveScrollKey = useMemo(
    () => liveTurnScrollKey(buildLiveTurnScrollSnapshot(activeTurn, handoffPresentation)),
    [activeTurn, handoffPresentation]
  );

  /**
   * Scrolls the latest message into view.
   */
  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, []);

  /**
   * Keeps the latest content in view when messages or live turn presentation changes.
   */
  useEffect(() => {
    scrollToBottom();
  }, [messages, sending, liveScrollKey, scrollToBottom]);

  const showLegacyThinking = sending && livePresentation == null;

  if (messages.length === 0 && !sending && livePresentation == null) {
    return (
      <EmptyState variant="centered" className="flex flex-col items-center gap-3 text-muted">
        <FaIcon icon={faComment} className="h-12 w-12" aria-hidden />
        Start the conversation.
      </EmptyState>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        aria-hidden="true"
        className="hc-chat-fade-top pointer-events-none absolute inset-x-0 top-0 z-10 h-5"
      />
      <Scrollbars axis="vertical" className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-3">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} onRevealProgress={scrollToBottom} />
          ))}
          {livePresentation != null ? <ActiveTurnPresentation {...livePresentation} /> : null}
          {showLegacyThinking ? (
            <div className="flex justify-start" role="status" aria-live="polite">
              <div className="rounded-lg border border-separator bg-control px-3 py-2 text-[14px] text-muted">
                Thinking…
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </Scrollbars>
    </div>
  );
}
