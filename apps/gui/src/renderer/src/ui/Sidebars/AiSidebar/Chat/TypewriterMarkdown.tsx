import { useCallback, type JSX } from 'react';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { clearMessageReveal } from '#/renderer/src/store/slices/aiChatSlice';
import { MarkdownContent } from './MarkdownContent';
import { useTypewriterReveal } from './useTypewriterReveal';

interface Props {
  /**
   * Full assistant message markdown to reveal.
   */
  content: string;

  /**
   * Chat id whose reveal tracking should clear when typing finishes.
   */
  chatId: number;

  /**
   * Called when typewriter progress updates so the list can stay scrolled.
   */
  onRevealProgress?: () => void;
}

/**
 * Renders assistant markdown with a one-shot typewriter reveal.
 *
 * Mount with a React `key` tied to the message id so each reply starts fresh.
 *
 * @param props - Content, chat id, and optional scroll callback.
 * @returns Live-updating markdown content for the revealing bubble.
 */
export function TypewriterMarkdown({ content, chatId, onRevealProgress }: Props): JSX.Element {
  const dispatch = useAppDispatch();

  /**
   * Clears reveal tracking once the typewriter finishes or is skipped.
   */
  const handleRevealComplete = useCallback(() => {
    dispatch(clearMessageReveal(chatId));
  }, [chatId, dispatch]);

  const visibleContent = useTypewriterReveal({
    content,
    onComplete: handleRevealComplete,
    onProgress: onRevealProgress
  });

  return <MarkdownContent content={visibleContent} variant="assistant" />;
}
