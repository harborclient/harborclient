import type { JSX } from 'react';
import type { ActiveTurnPresentationModel } from './activeTurnPresentationModel';
import { ActiveTurnToolRow } from './ActiveTurnToolRow';
import { AwaitingUserPrompt } from './AwaitingUserPrompt';
import { MarkdownContent } from './MarkdownContent';
import { ThinkingSection } from './ThinkingSection';

/**
 * Live in-flight assistant turn presentation with thoughts, tools, and waiting state.
 */
export function ActiveTurnPresentation({
  text,
  thought,
  toolRows,
  phase,
  pendingQuestion
}: ActiveTurnPresentationModel): JSX.Element {
  const showThinking = phase !== 'awaiting_user' && thought.trim().length > 0;
  const showGenerating = text.trim().length === 0 && phase !== 'awaiting_user';

  return (
    <div className="w-full p-3 text-text" aria-live="polite">
      {text.trim().length > 0 ? <MarkdownContent content={text} variant="assistant" /> : null}
      {showGenerating ? (
        <p role="status" className="text-[14px] text-muted">
          Generating…
        </p>
      ) : null}
      {showThinking ? <ThinkingSection thought={thought} /> : null}
      {toolRows.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1.5" aria-label="Tool progress">
          {toolRows.map((row) => (
            <ActiveTurnToolRow key={row.callId} row={row} />
          ))}
        </ul>
      ) : null}
      {phase === 'awaiting_user' && pendingQuestion != null ? (
        <AwaitingUserPrompt pendingQuestion={pendingQuestion} />
      ) : null}
    </div>
  );
}
