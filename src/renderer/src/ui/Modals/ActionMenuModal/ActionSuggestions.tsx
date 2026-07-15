import type { JSX } from 'react';
import { FaIcon } from '@harborclient/sdk/components';
import { actionCommandDisplayLabel, type ActionCommandDefinition } from '#/shared/search';
import { faBars } from '#/renderer/src/fontawesome';
import { searchResultRowClass } from '#/renderer/src/ui/Modals/ActionMenuModal/searchResultRowClass';

interface Props {
  /**
   * Matching actions for the current query prefix.
   */
  suggestions: ActionCommandDefinition[];

  /**
   * Index of the keyboard-highlighted suggestion row.
   */
  activeIndex: number;

  /**
   * Runs the selected action.
   */
  onSelect: (id: string) => void;

  /**
   * Updates keyboard highlight when the pointer hovers a row.
   */
  onHighlight: (index: number) => void;
}

/**
 * Renders Action menu quick-open suggestions while the user filters with `#`.
 */
export function ActionSuggestions({
  suggestions,
  activeIndex,
  onSelect,
  onHighlight
}: Props): JSX.Element {
  return (
    <div className="mb-2 min-w-0">
      <div className="mb-1 flex items-center gap-2 bg-sidebar-section px-2 py-1">
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
          <FaIcon icon={faBars} className="h-3 w-3 text-muted" aria-hidden />
        </span>
        <h2 className="m-0 text-[14px] font-medium uppercase tracking-wide text-muted">Actions</h2>
      </div>
      <ul className="m-0 min-w-0 list-none p-0" role="listbox" aria-label="Actions">
        {suggestions.map((suggestion, index) => {
          const isActive = index === activeIndex;
          const displayLabel = actionCommandDisplayLabel(suggestion);

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
                id={`action-menu-action-${index}`}
                aria-current={isActive ? 'true' : undefined}
                aria-label={displayLabel}
                className={searchResultRowClass(isActive)}
                onClick={() => onSelect(suggestion.id)}
              >
                <span className="flex min-w-0 w-full items-start gap-2">
                  <FaIcon
                    icon={faBars}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted"
                    aria-hidden
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate">{displayLabel}</span>
                    {suggestion.description != null && suggestion.description.length > 0 ? (
                      <span className="truncate text-[14px] text-muted">
                        {suggestion.description}
                      </span>
                    ) : null}
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
