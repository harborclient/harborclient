import type { JSX } from 'react';
import type { AiChatPendingQuestion } from '#/renderer/src/store/slices/aiChatSlice';

interface Props {
  /**
   * Pending `ask_user` question data for a paused turn.
   */
  pendingQuestion: AiChatPendingQuestion;
}

/**
 * Waiting-for-user presentation shown while an `ask_user` tool pauses the turn.
 *
 * Displays the question and optional choices without handling answer submission.
 */
export function AwaitingUserPrompt({ pendingQuestion }: Props): JSX.Element {
  const { question, choices } = pendingQuestion;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-3 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-[14px] text-text"
    >
      <p className="mb-1 font-medium text-text">Waiting for your answer</p>
      <p className="mb-0 break-words text-text">{question}</p>
      {choices != null && choices.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted" aria-label="Suggested answers">
          {choices.map((choice) => (
            <li key={choice} className="break-words">
              {choice}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
