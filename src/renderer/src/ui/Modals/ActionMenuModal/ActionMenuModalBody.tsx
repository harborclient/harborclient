import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent
} from 'react';
import { FaIcon, Input, Modal } from '@harborclient/sdk/components';
import {
  groupUnifiedSearchHits,
  isActionQuery,
  isSlashCommandQuery,
  matchActionSuggestions,
  matchSlashCommandSuggestions,
  resolveSlashCommand,
  searchAll,
  type UnifiedSearchHit
} from '#/shared/search';
import { useAiAvailability } from '#/renderer/src/hooks/useAiAvailability';
import { useActivateSearchHit } from '#/renderer/src/search/activateSearchHit';
import { useActionCommands } from '#/renderer/src/search/useActionCommands';
import { useSearchIndexes } from '#/renderer/src/search/useSearchIndexes';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { setShowAiSidebar } from '#/renderer/src/store/slices/navigationSlice';
import { startNewChatWithPrompt } from '#/renderer/src/store/thunks/aiChat';
import { ACTION_MENU_ICON_CLASS, iconActionMenu } from '#/renderer/src/icons/customIcons';
import { ActionSuggestions } from '#/renderer/src/ui/Modals/ActionMenuModal/ActionSuggestions';
import { ArmedSlashCommand } from '#/renderer/src/ui/Modals/ActionMenuModal/ArmedSlashCommand';
import { SearchResultGroup } from '#/renderer/src/ui/Modals/ActionMenuModal/SearchResultGroup';
import { SlashCommandSuggestions } from '#/renderer/src/ui/Modals/ActionMenuModal/SlashCommandSuggestions';

/**
 * Element id for the Action menu search field.
 */
const ACTION_MENU_INPUT_ID = 'action-menu-input';

/**
 * Debounce delay before running unified search against warm indexes.
 */
const SEARCH_DEBOUNCE_MS = 150;

interface Props {
  /**
   * Dismisses the Action menu modal.
   */
  onClose: () => void;
}

/**
 * Modal body for the global command palette with debounced unified search.
 */
export function ActionMenuModalBody({ onClose }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { searchContext, sidebarInput } = useSearchIndexes();
  const activateHit = useActivateSearchHit();
  const { aiSettings, aiAvailable } = useAiAvailability();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [commandError, setCommandError] = useState<string | null>(null);
  const { actions, runAction } = useActionCommands();
  const slashMode = isSlashCommandQuery(query);
  const actionMode = isActionQuery(query);

  /**
   * Slash command suggestions matching the current `/` query prefix.
   */
  const suggestions = useMemo(
    () => (slashMode ? matchSlashCommandSuggestions(query) : []),
    [query, slashMode]
  );

  /**
   * Action suggestions matching the current `#` query prefix.
   */
  const actionSuggestions = useMemo(
    () => (actionMode ? matchActionSuggestions(query, actions) : []),
    [actionMode, actions, query]
  );

  /**
   * Fully resolved slash command when the keyword is complete, otherwise null.
   */
  const resolvedCommand = useMemo(
    () => (slashMode ? resolveSlashCommand(query) : null),
    [query, slashMode]
  );

  /**
   * Updates the query and clears any slash-command validation error from a prior submit attempt.
   */
  const handleQueryChange = useCallback((nextQuery: string): void => {
    setCommandError(null);
    setQuery(nextQuery);
  }, []);

  /**
   * Debounces query updates and resets keyboard highlight before running unified search.
   */
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(query);
      setActiveIndex(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(handle);
    };
  }, [query]);

  /**
   * Unified search hits capped for the command palette dropdown.
   */
  const hits = useMemo(() => {
    if (slashMode || actionMode) {
      return [];
    }

    return searchAll(debouncedQuery, searchContext);
  }, [actionMode, debouncedQuery, searchContext, slashMode]);

  /**
   * Hits grouped by domain for section headings.
   */
  const groupedHits = useMemo(() => groupUnifiedSearchHits(hits), [hits]);

  /**
   * Flat index offsets for each grouped domain section.
   */
  const groupOffsets = useMemo(() => {
    const offsets: number[] = [];
    let running = 0;
    for (const group of groupedHits) {
      offsets.push(running);
      running += group.hits.length;
    }
    return offsets;
  }, [groupedHits]);

  /**
   * Focuses the search field when the modal opens.
   */
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  /**
   * Activates the currently highlighted hit or the clicked row.
   */
  const handleActivate = useCallback(
    (hit: UnifiedSearchHit) => {
      activateHit(hit, query);
    },
    [activateHit, query]
  );

  /**
   * Fills the input with a selected slash command keyword and returns focus to the field.
   */
  const handleSelectSuggestion = useCallback(
    (keyword: string): void => {
      handleQueryChange(`/${keyword} `);
      searchInputRef.current?.focus();
    },
    [handleQueryChange]
  );

  /**
   * Opens the AI sidebar, creates a new chat, and submits the resolved slash command prompt.
   */
  const handleSubmitCommand = useCallback(async (): Promise<void> => {
    if (resolvedCommand == null) {
      return;
    }

    if (!aiAvailable) {
      setCommandError('Configure an AI provider in Settings before using /ask.');
      return;
    }

    if (resolvedCommand.argument.trim().length === 0) {
      setCommandError('Type a question after /ask.');
      return;
    }

    onClose();
    dispatch(setShowAiSidebar(true));
    await dispatch(
      startNewChatWithPrompt({
        aiSettings,
        prompt: resolvedCommand.argument
      })
    );
  }, [aiAvailable, aiSettings, dispatch, onClose, resolvedCommand]);

  /**
   * Handles keyboard navigation within search results and slash command rows.
   */
  const handleInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (actionMode) {
        if (actionSuggestions.length === 0) {
          return;
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setActiveIndex((current) => (current + 1) % actionSuggestions.length);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          setActiveIndex(
            (current) => (current - 1 + actionSuggestions.length) % actionSuggestions.length
          );
        } else if (event.key === 'Enter') {
          event.preventDefault();
          const suggestion = actionSuggestions[activeIndex];
          if (suggestion != null) {
            runAction(suggestion.id);
          }
        }
        return;
      }

      if (slashMode) {
        if (resolvedCommand != null) {
          if (event.key === 'Enter') {
            event.preventDefault();
            void handleSubmitCommand();
          }
          return;
        }

        if (suggestions.length === 0) {
          return;
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setActiveIndex((current) => (current + 1) % suggestions.length);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
        } else if (event.key === 'Enter') {
          event.preventDefault();
          const suggestion = suggestions[activeIndex];
          if (suggestion != null) {
            handleSelectSuggestion(suggestion.keyword);
          }
        }
        return;
      }

      if (hits.length === 0) {
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((current) => (current + 1) % hits.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((current) => (current - 1 + hits.length) % hits.length);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const hit = hits[activeIndex];
        if (hit != null) {
          handleActivate(hit);
        }
      }
    },
    [
      actionMode,
      actionSuggestions,
      activeIndex,
      handleActivate,
      handleSelectSuggestion,
      handleSubmitCommand,
      hits,
      resolvedCommand,
      runAction,
      slashMode,
      suggestions
    ]
  );

  const hasActionSuggestions = actionMode && actionSuggestions.length > 0;
  const hasSlashSuggestions = slashMode && resolvedCommand == null && suggestions.length > 0;
  const hasSlashArmedCommand = slashMode && resolvedCommand != null;
  const hasSearchResults = !slashMode && !actionMode && hits.length > 0;
  const showNoSearchResults =
    !slashMode && !actionMode && debouncedQuery.trim().length > 0 && hits.length === 0;
  const activeDescendantId = hasActionSuggestions
    ? `action-menu-action-${activeIndex}`
    : hasSlashArmedCommand
      ? 'action-menu-command-armed'
      : hasSlashSuggestions
        ? `action-menu-suggestion-${activeIndex}`
        : hasSearchResults
          ? `action-menu-result-${activeIndex}`
          : undefined;

  return (
    <Modal
      label="Action menu"
      onClose={onClose}
      className="absolute left-1/2 top-[calc(12vh-40px)] z-10 flex w-[min(42rem,calc(100vw-2rem))] max-h-[70vh] -translate-x-1/2 flex-col overflow-hidden"
      overlayClassName="z-50 bg-black/35"
    >
      <div className="flex min-w-0 flex-col gap-2 overflow-hidden p-1">
        <label htmlFor={ACTION_MENU_INPUT_ID} className="sr-only">
          Action menu
        </label>
        <div className="relative min-w-0">
          <FaIcon
            icon={iconActionMenu}
            className={`${ACTION_MENU_ICON_CLASS} pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted`}
            aria-hidden
          />
          <Input
            ref={searchInputRef}
            id={ACTION_MENU_INPUT_ID}
            type="search"
            placeholder="Action menu… · Type / for commands · Type # for actions"
            value={query}
            className="w-full pl-10"
            autoComplete="off"
            aria-controls="action-menu-results"
            aria-expanded={
              hasActionSuggestions ||
              hasSlashSuggestions ||
              hasSlashArmedCommand ||
              hasSearchResults
            }
            aria-activedescendant={activeDescendantId}
            onChange={(event) => handleQueryChange(event.target.value)}
            onKeyDown={handleInputKeyDown}
          />
        </div>

        <div
          id="action-menu-results"
          className="min-w-0 max-h-[min(24rem,50vh)] overflow-x-hidden overflow-y-auto"
          role="region"
          aria-live="polite"
          aria-label="Search results"
        >
          {commandError ? (
            <p className="px-2 py-1.5 text-[14px] text-danger" role="alert">
              {commandError}
            </p>
          ) : null}

          {hasActionSuggestions ? (
            <ActionSuggestions
              suggestions={actionSuggestions}
              activeIndex={activeIndex}
              onSelect={runAction}
              onHighlight={setActiveIndex}
            />
          ) : null}

          {actionMode && actionSuggestions.length === 0 ? (
            <p className="px-2 py-1.5 text-[14px] text-muted" role="status">
              No matching actions.
            </p>
          ) : null}

          {hasSlashArmedCommand && resolvedCommand != null ? (
            <ArmedSlashCommand resolved={resolvedCommand} />
          ) : null}

          {hasSlashSuggestions ? (
            <SlashCommandSuggestions
              suggestions={suggestions}
              activeIndex={activeIndex}
              onSelect={handleSelectSuggestion}
              onHighlight={setActiveIndex}
            />
          ) : null}

          {slashMode && resolvedCommand == null && suggestions.length === 0 ? (
            <p className="px-2 py-1.5 text-[14px] text-muted" role="status">
              No matching commands.
            </p>
          ) : null}

          {showNoSearchResults ? (
            <p className="px-2 py-1.5 text-[14px] text-muted" role="status">
              No results match your search.
            </p>
          ) : null}

          {groupedHits.map((group, groupIndex) => (
            <SearchResultGroup
              key={group.domain}
              domain={group.domain}
              hits={group.hits}
              activeIndex={activeIndex}
              indexOffset={groupOffsets[groupIndex] ?? 0}
              sidebarInput={sidebarInput}
              onActivate={handleActivate}
              onHighlight={setActiveIndex}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
}
