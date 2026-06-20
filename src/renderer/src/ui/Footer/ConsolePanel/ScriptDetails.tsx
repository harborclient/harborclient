import type { JSX } from 'react';
import type { ConsoleEntry } from '#/renderer/src/store';
import { SectionTitle } from './SectionTitle';

interface Props {
  entry: ConsoleEntry;
}

/**
 * Renders script logs, tests, and errors from a console entry.
 */
export function ScriptDetails({ entry }: Props): JSX.Element | null {
  const hasScripts =
    (entry.logs && entry.logs.length > 0) ||
    (entry.tests && entry.tests.length > 0) ||
    Boolean(entry.scriptError);

  if (!hasScripts) return null;

  return (
    <div className="mb-4">
      <SectionTitle title="Scripts" />
      {entry.scriptError && (
        <div className="mb-2 rounded-md bg-danger/10 px-2.5 py-2 text-[13px] text-danger whitespace-pre-wrap">
          {entry.scriptError}
        </div>
      )}
      {entry.logs && entry.logs.length > 0 && (
        <pre className="mb-2 overflow-auto rounded-md border border-separator bg-control px-2.5 py-2 font-mono text-[12px] text-text">
          {entry.logs.join('\n')}
        </pre>
      )}
      {entry.tests && entry.tests.length > 0 && (
        <div className="overflow-hidden rounded-md border border-separator">
          {entry.tests.map((test, index) => (
            <div
              key={`${test.name}-${index}`}
              className={`flex items-center gap-2 px-2.5 py-1.5 ${index > 0 ? 'border-t border-separator' : ''}`}
            >
              <span
                className={`inline-block h-2 w-2 shrink-0 rounded-full ${test.passed ? 'bg-success' : 'bg-danger'}`}
              />
              <span className="text-[13px] text-text">{test.name}</span>
              {!test.passed && test.error && (
                <span className="text-[12px] text-danger">{test.error}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
