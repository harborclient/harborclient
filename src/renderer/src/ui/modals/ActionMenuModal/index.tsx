import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent
} from 'react';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FaIcon, Input, Modal } from '@harborclient/sdk/components';
import {
  actionCommandDisplayLabel,
  groupUnifiedSearchHits,
  isActionQuery,
  isSlashCommandQuery,
  matchActionSuggestions,
  matchSlashCommandSuggestions,
  resolveSlashCommand,
  SEARCH_DOMAIN_LABELS,
  searchAll,
  sidebarRequestBreadcrumb,
  type ActionCommandDefinition,
  type ResolvedSlashCommand,
  type SearchDomain,
  type SidebarSearchInput,
  type SlashCommandDefinition,
  type UnifiedSearchHit
} from '#/shared/search';
import {
  faBars,
  faFolder,
  faGear,
  faGlobe,
  faPalette,
  faPaperPlane,
  faPuzzlePiece,
  faTerminal,
  faWandMagicSparkles
} from '#/renderer/src/fontawesome';
import { useAiAvailability } from '#/renderer/src/hooks/useAiAvailability';
import { useActivateSearchHit } from '#/renderer/src/search/activateSearchHit';
import { useActionCommands } from '#/renderer/src/search/useActionCommands';
import { useSearchIndexes } from '#/renderer/src/search/useSearchIndexes';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { setShowAiSidebar } from '#/renderer/src/store/slices/navigationSlice';
import {
  closeActionMenuModal,
  selectActionMenuModal
} from '#/renderer/src/store/slices/modalsSlice';
import { startNewChatWithPrompt } from '#/renderer/src/store/thunks/aiChat';
import { BreadcrumbPrefix } from '#/renderer/src/ui/Main/RequestEditor/Editor/BreadcrumbPrefix';
import { METHOD_CLASSES } from '#/renderer/src/ui/shared/classes';

/** Element id for the Action menu search field. */
const ACTION_MENU_INPUT_ID = 'action-menu-input';

/** Debounce delay before running unified search against warm indexes. */
const SEARCH_DEBOUNCE_MS = 150;

/**
 * Tailwind classes for one search result row in the command palette.
 *
 * @param active - Whether this row is keyboard- or pointer-highlighted.
 */
function searchResultRowClass(active: boolean): string {
  const base =
    'flex w-full min-w-0 flex-col items-stretch gap-0 rounded-md border-none px-1.5 py-0.5 text-left app-no-drag';
  return active
    ? `${base} cursor-pointer bg-selection`
    : `${base} cursor-pointer hover:bg-selection/60`;
}

/**
 * Domain icons shown beside grouped result section headings.
 */
const DOMAIN_ICONS: Record<SearchDomain, IconDefinition> = {
  collection: faFolder,
  folder: faFolder,
  request: faPaperPlane,
  environment: faGlobe,
  setting: faGear,
  page: faTerminal,
  plugin: faPuzzlePiece,
  theme: faPalette,
  snippet: faTerminal
};

/**
 * Builds an accessible label for a plugin or theme search result row.
 *
 * @param hit - Unified search hit for an installed or marketplace plugin/theme.
 */
function pluginSearchResultLabel(hit: UnifiedSearchHit): string | undefined {
  if (hit.domain !== 'plugin' && hit.domain !== 'theme') {
    return undefined;
  }

  const sourceLabel = hit.pluginListingSource === 'installed' ? 'Installed' : 'Marketplace';
  return `${sourceLabel}, ${hit.title}`;
}

/**
 * Builds an accessible label for a request search result row.
 *
 * @param hit - Unified search hit for a saved request.
 * @param breadcrumb - Resolved collection and folder names for the request.
 */
function requestSearchResultLabel(
  hit: UnifiedSearchHit,
  breadcrumb: ReturnType<typeof sidebarRequestBreadcrumb>
): string | undefined {
  if (hit.domain !== 'request') {
    return undefined;
  }

  const parts = [breadcrumb.collectionName, breadcrumb.folderName, hit.method, hit.title].filter(
    (part): part is string => part != null && part.length > 0
  );
  return parts.length > 0 ? parts.join(', ') : undefined;
}

interface ModalBodyProps {
  /** Dismisses the Action menu modal. */
  onClose: () => void;
}

interface SearchResultGroupProps {
  /** Domain category for this result group. */
  domain: SearchDomain;
  /** Hits belonging to this domain. */
  hits: UnifiedSearchHit[];
  /** Index of the globally highlighted hit, if any. */
  activeIndex: number;
  /** Flat ordered list index offset for the first hit in this group. */
  indexOffset: number;
  /** Sidebar data used to resolve request breadcrumb names. */
  sidebarInput: SidebarSearchInput;
  /** Activates a hit on click or Enter. */
  onActivate: (hit: UnifiedSearchHit) => void;
  /** Updates keyboard highlight when the pointer hovers a row. */
  onHighlight: (flatIndex: number) => void;
}

/**
 * Renders one domain group with a sidebar-style section heading and result rows.
 */
function SearchResultGroup({
  domain,
  hits,
  activeIndex,
  indexOffset,
  sidebarInput,
  onActivate,
  onHighlight
}: SearchResultGroupProps): JSX.Element {
  return (
    <div className="mb-2 min-w-0">
      <div className="mb-1 flex items-center gap-2 bg-sidebar-section px-2 py-1">
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
          <FaIcon icon={DOMAIN_ICONS[domain]} className="h-3 w-3 text-muted" aria-hidden />
        </span>
        <h2 className="m-0 text-[14px] font-medium uppercase tracking-wide text-muted">
          {SEARCH_DOMAIN_LABELS[domain]}
        </h2>
      </div>
      <ul
        className="m-0 min-w-0 list-none p-0"
        role="listbox"
        aria-label={SEARCH_DOMAIN_LABELS[domain]}
      >
        {hits.map((hit, localIndex) => {
          const flatIndex = indexOffset + localIndex;
          const isActive = flatIndex === activeIndex;
          const requestBreadcrumb =
            hit.domain === 'request'
              ? sidebarRequestBreadcrumb(sidebarInput, hit.collectionId, hit.folderId)
              : null;
          const requestLabel =
            requestBreadcrumb != null
              ? requestSearchResultLabel(hit, requestBreadcrumb)
              : undefined;
          const pluginLabel = pluginSearchResultLabel(hit);
          const rowLabel = requestLabel ?? pluginLabel;

          return (
            <li
              key={`${hit.domain}:${hit.id}:${hit.pluginListingSource ?? 'default'}`}
              role="presentation"
              className="min-w-0"
              onMouseEnter={() => onHighlight(flatIndex)}
            >
              <button
                type="button"
                role="option"
                id={`action-menu-result-${flatIndex}`}
                aria-current={isActive ? 'true' : undefined}
                aria-label={rowLabel}
                className={searchResultRowClass(isActive)}
                onClick={() => onActivate(hit)}
              >
                {hit.domain === 'request' ? (
                  <span className="flex min-w-0 w-full items-center gap-1">
                    <BreadcrumbPrefix
                      collectionName={requestBreadcrumb?.collectionName}
                      folderName={requestBreadcrumb?.folderName}
                      compact
                    />
                    {hit.method != null ? (
                      <span
                        className={`shrink-0 px-1 py-px text-[16px] ${METHOD_CLASSES[hit.method.toLowerCase()] ?? 'text-info'}`}
                      >
                        {hit.method}
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1 truncate text-[16px]">{hit.title}</span>
                  </span>
                ) : hit.domain === 'plugin' || hit.domain === 'theme' ? (
                  <span className="flex min-w-0 w-full items-center gap-1">
                    <BreadcrumbPrefix
                      collectionName={
                        hit.pluginListingSource === 'installed' ? 'Installed' : 'Marketplace'
                      }
                      compact
                    />
                    <span className="min-w-0 flex-1 truncate text-[16px]">{hit.title}</span>
                  </span>
                ) : (
                  <span className="min-w-0 w-full truncate text-[16px]">{hit.title}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface SlashCommandSuggestionsProps {
  /** Matching slash commands for the current query prefix. */
  suggestions: SlashCommandDefinition[];
  /** Index of the keyboard-highlighted suggestion row. */
  activeIndex: number;
  /** Fills the input with a selected command keyword. */
  onSelect: (keyword: string) => void;
  /** Updates keyboard highlight when the pointer hovers a row. */
  onHighlight: (index: number) => void;
}

/**
 * Renders slash command suggestions while the user is still typing a keyword.
 */
function SlashCommandSuggestions({
  suggestions,
  activeIndex,
  onSelect,
  onHighlight
}: SlashCommandSuggestionsProps): JSX.Element {
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
                    <span className="truncate text-[16px]">{suggestion.label}</span>
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

interface ActionSuggestionsProps {
  /** Matching actions for the current query prefix. */
  suggestions: ActionCommandDefinition[];
  /** Index of the keyboard-highlighted suggestion row. */
  activeIndex: number;
  /** Runs the selected action. */
  onSelect: (id: string) => void;
  /** Updates keyboard highlight when the pointer hovers a row. */
  onHighlight: (index: number) => void;
}

/**
 * Renders Action menu quick-open suggestions while the user filters with `#`.
 */
function ActionSuggestions({
  suggestions,
  activeIndex,
  onSelect,
  onHighlight
}: ActionSuggestionsProps): JSX.Element {
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
                    <span className="truncate text-[16px]">{displayLabel}</span>
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

interface ArmedSlashCommandProps {
  /** Fully resolved slash command and argument preview. */
  resolved: ResolvedSlashCommand;
}

/**
 * Renders the armed slash command row shown once a command keyword is fully matched.
 */
function ArmedSlashCommand({ resolved }: ArmedSlashCommandProps): JSX.Element {
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
                <span className="truncate text-[16px]">{resolved.command.label}</span>
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

/**
 * Modal body for the global command palette with debounced unified search.
 */
function ActionMenuModalBody({ onClose }: ModalBodyProps): JSX.Element {
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
  const suggestions = useMemo(
    () => (slashMode ? matchSlashCommandSuggestions(query) : []),
    [query, slashMode]
  );
  const actionSuggestions = useMemo(
    () => (actionMode ? matchActionSuggestions(query, actions) : []),
    [actionMode, actions, query]
  );
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
      className="flex w-[min(42rem,calc(100vw-2rem))] max-h-[70vh] flex-col self-start overflow-hidden mt-[12vh]"
      overlayClassName="bg-black/35"
    >
      <div className="flex min-w-0 flex-col gap-2 overflow-hidden p-1">
        <label htmlFor={ACTION_MENU_INPUT_ID} className="sr-only">
          Action menu
        </label>
        <Input
          ref={searchInputRef}
          id={ACTION_MENU_INPUT_ID}
          type="search"
          placeholder="Action menu… · Type / for commands · Type # for actions"
          value={query}
          className="w-full"
          autoComplete="off"
          aria-controls="action-menu-results"
          aria-expanded={
            hasActionSuggestions || hasSlashSuggestions || hasSlashArmedCommand || hasSearchResults
          }
          aria-activedescendant={activeDescendantId}
          onChange={(event) => handleQueryChange(event.target.value)}
          onKeyDown={handleInputKeyDown}
        />

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

/**
 * Global command palette for searching collections, settings, and plugins.
 */
export function ActionMenuModal(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const actionMenu = useAppSelector(selectActionMenuModal);

  /**
   * Closes the Action menu modal.
   */
  const handleClose = useCallback((): void => {
    dispatch(closeActionMenuModal());
  }, [dispatch]);

  if (actionMenu?.open !== true) {
    return null;
  }

  return <ActionMenuModalBody key="action-menu" onClose={handleClose} />;
}
