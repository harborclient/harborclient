import type { JSX } from 'react';
import { FaIcon } from '@harborclient/sdk/components';
import type { ResolvedSlashCommand } from '#/shared/search';
import { faTerminal, faWandMagicSparkles } from '#/renderer/src/fontawesome';
import { searchResultRowClass } from './searchResultRowClass';

interface Props {
  /**
   * Fully resolved slash command and argument preview.
   */
  resolved: ResolvedSlashCommand;
}

/**
 * Renders the armed slash command row shown once a command keyword is fully matched.
 */
export function ArmedSlashCommand({ resolved }: Props): JSX.Element {
  const preview = resolved.argument.length > 0 ? resolved.argument : 'Type your question…';

  return (
    <div className="mb-2 min-w-0">
      <div className="mb-1 flex items-center gap-2 bg-sidebar-section px-2 py-1">
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
          <FaIcon icon={faTerminal} className="h-3 w-3 text-muted" aria-hidden />
        </span>
        <h2 className="m-0 text-[14px] font-medium uppercase tracking-wide text-muted">Commands</h2>
      </div>
      <ul className="m-0 min-w-0 list-none p-0" role="listbox" aria-label="Commands">
        <li role="presentation" className="min-w-0">
          <div
            id="action-menu-command-armed"
            role="option"
            aria-current="true"
            aria-label={`${resolved.command.label}, ${preview}`}
            className={searchResultRowClass(true)}
          >
            <span className="flex min-w-0 w-full items-start gap-2">
              <FaIcon
                icon={faWandMagicSparkles}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted"
                aria-hidden
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate">{resolved.command.label}</span>
                <span
                  className={`truncate text-[14px] ${resolved.argument.length > 0 ? 'text-text' : 'text-muted'}`}
                >
                  {preview}
                </span>
              </span>
            </span>
          </div>
        </li>
      </ul>
      <p className="px-2 py-1 text-[14px] text-muted" role="status">
        Press Enter to start a new chat.
      </p>
    </div>
  );
}
