import type { JSX } from 'react';
import type { ScriptRunError } from '@harborclient/core/types';
import { ScriptErrorRow } from './ScriptErrorRow';

interface Props {
  /**
   * Structured script failures from the send, when available.
   */
  scriptErrors?: readonly ScriptRunError[];

  /**
   * Joined script error text used when no structured failures exist
   * (imported run results, collection runner summaries).
   */
  fallbackText?: string;

  /**
   * Request tab that produced these errors; preferred for jump-to-editor.
   */
  requestTabId?: string;
}

/**
 * Script failure list for the console Output section.
 *
 * Renders each structured failure as a clickable row that reveals the mapped
 * error line in the script editor, falling back to a plain error block when
 * only the joined string form is available.
 */
export function ScriptErrorList({ scriptErrors, fallbackText, requestTabId }: Props): JSX.Element {
  if (scriptErrors == null || scriptErrors.length === 0) {
    return (
      <div className="whitespace-pre-wrap rounded-md bg-danger/10 px-2.5 py-2 text-[14px] text-danger">
        {fallbackText}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {scriptErrors.map((error, index) => (
        <ScriptErrorRow
          key={`${error.scriptId ?? ''}:${error.phase ?? ''}:${index}`}
          error={error}
          requestTabId={requestTabId}
        />
      ))}
    </div>
  );
}
