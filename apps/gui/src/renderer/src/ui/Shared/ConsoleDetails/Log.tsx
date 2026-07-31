import type { JSX } from 'react';
import type { ScriptLogLevel } from '@harborclient/core/types';

/**
 * Visual severity for shared console log text rendering.
 *
 * Includes `debug` for API symmetry; debug uses the same styling as `log`.
 */
export type ConsoleLogType = ScriptLogLevel | 'debug';

interface Props {
  /**
   * Severity / console method family that controls text styling.
   */
  type: ConsoleLogType;

  /**
   * Formatted message text (may be multi-line).
   */
  message: string;
}

/**
 * Shared text body for console.log / error / warn / debug (and similar) lines.
 */
export function Log({ type, message }: Props): JSX.Element {
  const textClass =
    type === 'error' ? 'text-danger' : type === 'warn' ? 'text-warning' : 'text-inherit';

  return (
    <pre
      className={`m-0 min-w-0 flex-1 overflow-x-auto font-mono text-[14px] whitespace-pre-wrap break-words ${textClass}`}
    >
      {message}
    </pre>
  );
}
