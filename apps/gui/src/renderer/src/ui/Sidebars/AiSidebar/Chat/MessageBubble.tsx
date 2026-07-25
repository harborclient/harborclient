import { fieldFrame } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { ChatMessage } from '@harborclient/core/types';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectRevealingMessageIdByChat } from '#/renderer/src/store/slices/aiChatSlice';
import { MarkdownContent } from './MarkdownContent';
import { TypewriterMarkdown } from './TypewriterMarkdown';

interface Props {
  /**
   * Message to render.
   */
  message: ChatMessage;

  /**
   * Called when typewriter progress updates so the list can stay scrolled.
   */
  onRevealProgress?: () => void;
}

/**
 * Renders a full-width chat message bubble styled by role.
 *
 * Assistant replies may typewriter-reveal when marked in Redux; user messages
 * always show their full content immediately.
 *
 * @param props - Message and optional reveal scroll callback.
 * @returns Role-styled message bubble.
 */
export function MessageBubble({ message, onRevealProgress }: Props): JSX.Element {
  const revealingMessageIdByChat = useAppSelector(selectRevealingMessageIdByChat);
  const isUser = message.role === 'user';
  const isRevealing = !isUser && revealingMessageIdByChat[message.chatId] === message.id;

  return (
    <div
      className={isUser ? `${fieldFrame} w-full p-3 text-text` : 'w-full p-3 text-text'}
      {...(isRevealing ? { 'aria-live': 'polite' as const } : {})}
    >
      {isRevealing ? (
        <TypewriterMarkdown
          key={message.id}
          content={message.content}
          chatId={message.chatId}
          onRevealProgress={onRevealProgress}
        />
      ) : (
        <MarkdownContent content={message.content} variant={isUser ? 'user' : 'assistant'} />
      )}
    </div>
  );
}
