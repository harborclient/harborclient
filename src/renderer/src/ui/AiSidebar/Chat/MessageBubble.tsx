import type { JSX } from 'react';
import type { ChatMessage } from '#/shared/types';
import { MarkdownContent } from './MarkdownContent';

interface Props {
  /**
   * Message to render.
   */
  message: ChatMessage;
}

/**
 * Renders a single chat message bubble aligned by role.
 */
export function MessageBubble({ message }: Props): JSX.Element {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={
          isUser
            ? 'max-w-[95%] rounded-lg bg-accent px-3 py-2 text-[16px] text-white'
            : 'max-w-[95%] rounded-lg bg-selection px-3 py-2 text-[16px] text-text'
        }
      >
        <MarkdownContent content={message.content} variant={isUser ? 'user' : 'assistant'} />
      </div>
    </div>
  );
}
