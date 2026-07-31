import type { JSX } from 'react';

interface Props {
  /**
   * Trace header plus sanitized stack frames.
   */
  message: string;
}

/**
 * Renders a console.trace line as preformatted stack text.
 */
export function Trace({ message }: Props): JSX.Element {
  return (
    <pre className="m-0 min-w-0 flex-1 overflow-x-auto font-mono text-[14px] whitespace-pre-wrap break-words">
      {message}
    </pre>
  );
}
