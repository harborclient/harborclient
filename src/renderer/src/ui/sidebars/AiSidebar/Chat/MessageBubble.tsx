import { fieldFrame } from '@harborclient/sdk/components';
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
 * Renders a full-width chat message bubble styled by role.
 */
export function MessageBubble({ message }: Props): JSX.Element {
  const isUser = message.role === 'user';

  return (
    <div
      className={
        isUser
          ? `${fieldFrame} w-full p-3 text-[16px] text-text`
          : 'w-full p-3 text-[16px] text-text'
      }
    >
      <MarkdownContent content={message.content} variant={isUser ? 'user' : 'assistant'} />
    </div>
  );
}
