import { EmptyState } from '@harborclient/sdk/components';
import { useEffect, useRef, type JSX } from 'react';
import type { ChatMessage } from '#/shared/types';

import { MessageBubble } from './MessageBubble';

interface Props {
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
 */
export function MessageList({ messages, sending }: Props): JSX.Element {
  const bottomRef = useRef<HTMLDivElement>(null);

  /**
   * Keeps the latest message in view when messages change or sending starts.
   */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, sending]);

  if (messages.length === 0 && !sending) {
    return <EmptyState variant="centered">Start the conversation.</EmptyState>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      {sending && (
        <div className="flex justify-start" role="status" aria-live="polite">
          <div className="rounded-lg border border-separator bg-control px-3 py-2 text-[14px] text-muted">
            Thinking…
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
