import type { JSX } from 'react';
import { FaIcon } from '@harborclient/sdk/components';
import type { SlashCommandDefinition } from '#/shared/search';
import { faTerminal, faWandMagicSparkles } from '#/renderer/src/fontawesome';
import { searchResultRowClass } from './searchResultRowClass';

interface Props {
  /**
   * Matching slash commands for the current query prefix.
   */
  suggestions: SlashCommandDefinition[];

  /**
   * Index of the keyboard-highlighted suggestion row.
   */
  activeIndex: number;

  /**
   * Fills the input with a selected command keyword.
   */
  onSelect: (keyword: string) => void;

  /**
   * Updates keyboard highlight when the pointer hovers a row.
   */
  onHighlight: (index: number) => void;
}

/**
 * Renders slash command suggestions while the user is still typing a keyword.
 */
export function SlashCommandSuggestions({
  suggestions,
  activeIndex,
  onSelect,
  onHighlight
}: Props): JSX.Element {
  return (
    <div className="mb-2 min-w-0">
      <div className="mb-1 flex items-center gap-2 bg-sidebar-section px-2 py-1">
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
          <FaIcon icon={faTerminal} className="h-3 w-3 text-muted" aria-hidden />
        </span>
        <h2 className="m-0 text-[14px] font-medium uppercase tracking-wide text-muted">Commands</h2>
      </div>
      <ul className="m-0 min-w-0 list-none p-0" role="listbox" aria-label="Commands">
        {suggestions.map((suggestion, index) => {
          const isActive = index === activeIndex;

          return (
            <li
              key={suggestion.id}
              role="presentation"
              className="min-w-0"
              onMouseEnter={() => onHighlight(index)}
            >
              <button
                type="button"
                role="option"
                id={`action-menu-suggestion-${index}`}
                aria-current={isActive ? 'true' : undefined}
                aria-label={`${suggestion.label}, ${suggestion.description}`}
                className={searchResultRowClass(isActive)}
                onClick={() => onSelect(suggestion.keyword)}
              >
                <span className="flex min-w-0 w-full items-start gap-2">
                  <FaIcon
                    icon={faWandMagicSparkles}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted"
                    aria-hidden
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate">{suggestion.label}</span>
                    <span className="truncate text-[14px] text-muted">
                      {suggestion.description}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
