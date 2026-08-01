import type { ISearchOptions } from '@xterm/addon-search';
import { RoundButton } from '@harborclient/sdk/components';
import { useEffect, useRef, useState, type JSX, type KeyboardEvent } from 'react';
import { faChevronDown, faChevronUp } from '#/renderer/src/fontawesome';
import { LogSearchInput } from '#/renderer/src/ui/Shared/LogSearch/LogSearchInput';
import {
  DEFAULT_LOG_MATCH_OPTIONS,
  isLogFilterQueryValid,
  type LogMatchOptions
} from '#/renderer/src/ui/Shared/LogSearch/logMatchOptions';
import { getTerminalSearchAddon } from './terminalRegistry';

/**
 * Debounce window before running an incremental buffer search while typing.
 */
const SEARCH_DEBOUNCE_MS = 150;

/**
 * Decorations for SearchAddon matches (requires #RRGGBB).
 */
const SEARCH_DECORATIONS: NonNullable<ISearchOptions['decorations']> = {
  matchBackground: '#3a5f8a',
  matchBorder: '#92a8b8',
  matchOverviewRuler: '#92a8b8',
  activeMatchBackground: '#32d2e2',
  activeMatchBorder: '#ffffff',
  activeMatchColorOverviewRuler: '#32d2e2'
};

interface Props {
  /**
   * Active terminal tab id whose buffer is searched.
   */
  activeTerminalId: string | null;

  /**
   * Closes the slide-down search bar (Escape or parent toggle).
   */
  onClose: () => void;
}

/**
 * Maps shared log-match toggles onto xterm SearchAddon options.
 *
 * @param options - Case / whole-word / regex toggles from {@link LogSearchInput}.
 * @param incremental - When true, expands the current match while typing.
 * @returns Options for findNext / findPrevious.
 */
function toSearchOptions(options: LogMatchOptions, incremental = false): ISearchOptions {
  return {
    caseSensitive: options.matchCase,
    wholeWord: options.matchWholeWord,
    regex: options.useRegex,
    incremental,
    decorations: SEARCH_DECORATIONS
  };
}

/**
 * Slide-down terminal search strip: shared LogSearch input plus previous/next.
 *
 * Drives `@xterm/addon-search` on the active terminal tab.
 *
 * @param props - Active terminal id and close handler.
 * @returns Search toolbar content.
 */
export function TerminalSearchBar({ activeTerminalId, onClose }: Props): JSX.Element {
  const [query, setQuery] = useState('');
  const [matchOptions, setMatchOptions] = useState<LogMatchOptions>(DEFAULT_LOG_MATCH_OPTIONS);
  const [resultIndex, setResultIndex] = useState(-1);
  const [resultCount, setResultCount] = useState(0);
  const inputWrapperRef = useRef<HTMLDivElement | null>(null);
  const activeTerminalIdRef = useRef(activeTerminalId);

  /**
   * Whether the live query is an invalid regular expression while regex mode is on.
   */
  const invalidRegex = !isLogFilterQueryValid(query, matchOptions);

  /**
   * Keeps the latest active terminal id available for unmount cleanup.
   */
  useEffect(() => {
    activeTerminalIdRef.current = activeTerminalId;
  }, [activeTerminalId]);

  /**
   * Focuses the search field when the bar mounts.
   */
  useEffect(() => {
    const input = inputWrapperRef.current?.querySelector<HTMLInputElement>('input');
    input?.focus();
  }, []);

  /**
   * Subscribes to SearchAddon result-count updates; retries until the addon is registered.
   */
  useEffect(() => {
    if (activeTerminalId == null) {
      return;
    }

    let disposed = false;
    let resultDisposable: { dispose: () => void } | null = null;

    /**
     * Attaches onDidChangeResults when the addon becomes available.
     *
     * @returns True when subscription succeeded.
     */
    const trySubscribe = (): boolean => {
      if (disposed) {
        return true;
      }
      const addon = getTerminalSearchAddon(activeTerminalId);
      if (addon == null) {
        return false;
      }

      /**
       * Updates the match counter shown beside the next/prev controls.
       *
       * @param event - SearchAddon result change payload.
       */
      const handleResults = (event: { resultIndex: number; resultCount: number }): void => {
        setResultIndex(event.resultIndex);
        setResultCount(event.resultCount);
      };

      resultDisposable = addon.onDidChangeResults(handleResults);
      return true;
    };

    if (trySubscribe()) {
      return () => {
        disposed = true;
        resultDisposable?.dispose();
      };
    }

    const interval = window.setInterval(() => {
      if (trySubscribe()) {
        window.clearInterval(interval);
      }
    }, 50);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      resultDisposable?.dispose();
    };
  }, [activeTerminalId]);

  /**
   * Debounced incremental search against the active terminal buffer.
   */
  useEffect(() => {
    const handle = window.setTimeout(() => {
      const addon = activeTerminalId == null ? undefined : getTerminalSearchAddon(activeTerminalId);
      if (addon == null) {
        return;
      }

      const trimmed = query.trim();
      if (trimmed === '' || !isLogFilterQueryValid(query, matchOptions)) {
        addon.clearDecorations();
        setResultIndex(-1);
        setResultCount(0);
        return;
      }

      addon.findNext(trimmed, toSearchOptions(matchOptions, true));
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(handle);
    };
  }, [activeTerminalId, matchOptions, query]);

  /**
   * Clears decorations when the search bar unmounts.
   */
  useEffect(() => {
    return () => {
      const id = activeTerminalIdRef.current;
      if (id == null) {
        return;
      }
      getTerminalSearchAddon(id)?.clearDecorations();
    };
  }, []);

  /**
   * Moves to the next match in the active terminal buffer.
   *
   * @returns True when a match was selected.
   */
  const findNext = (): boolean => {
    const addon = activeTerminalId == null ? undefined : getTerminalSearchAddon(activeTerminalId);
    const trimmed = query.trim();
    if (addon == null || trimmed === '' || invalidRegex) {
      return false;
    }
    return addon.findNext(trimmed, toSearchOptions(matchOptions));
  };

  /**
   * Moves to the previous match in the active terminal buffer.
   *
   * @returns True when a match was selected.
   */
  const findPrevious = (): boolean => {
    const addon = activeTerminalId == null ? undefined : getTerminalSearchAddon(activeTerminalId);
    const trimmed = query.trim();
    if (addon == null || trimmed === '' || invalidRegex) {
      return false;
    }
    return addon.findPrevious(trimmed, toSearchOptions(matchOptions));
  };

  /**
   * Handles Enter / arrows / Escape on the search field.
   *
   * @param event - Keyboard event from the search input.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.shiftKey) {
        findPrevious();
        return;
      }
      findNext();
      return;
    }

    if (event.key === 'ArrowDown' || (event.key === 'F3' && !event.shiftKey)) {
      event.preventDefault();
      findNext();
      return;
    }

    if (event.key === 'ArrowUp' || (event.key === 'F3' && event.shiftKey)) {
      event.preventDefault();
      findPrevious();
    }
  };

  const controlsDisabled = query.trim() === '' || invalidRegex || activeTerminalId == null;
  const resultLabel =
    query.trim() === ''
      ? null
      : resultCount === 0
        ? 'No results'
        : resultIndex < 0
          ? `${resultCount} results`
          : `${resultIndex + 1} of ${resultCount}`;

  return (
    <div
      className="border-b border-separator bg-sidebar p-3"
      role="search"
      aria-label="Terminal search"
    >
      <div className="flex items-center gap-2">
        <div ref={inputWrapperRef} className="min-w-0 flex-1">
          <LogSearchInput
            id="footer-terminal-search"
            label="Search terminal"
            placeholder="Search"
            value={query}
            onChange={setQuery}
            options={matchOptions}
            onOptionsChange={setMatchOptions}
            invalidRegex={invalidRegex}
            onKeyDown={handleKeyDown}
          />
        </div>
        {resultLabel != null ? (
          <span
            className="text-muted shrink-0 text-[14px] tabular-nums"
            role="status"
            aria-live="polite"
          >
            {resultLabel}
          </span>
        ) : null}
        <RoundButton
          icon={faChevronUp}
          ariaLabel="Previous match"
          title="Previous match"
          disabled={controlsDisabled}
          onClick={() => {
            findPrevious();
          }}
        />
        <RoundButton
          icon={faChevronDown}
          ariaLabel="Next match"
          title="Next match"
          disabled={controlsDisabled}
          onClick={() => {
            findNext();
          }}
        />
      </div>
    </div>
  );
}
