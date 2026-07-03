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
  groupUnifiedSearchHits,
  SEARCH_DOMAIN_LABELS,
  searchAll,
  type SearchDomain,
  type UnifiedSearchHit
} from '#/shared/search';
import { faFolder, faGear, faGlobe, faPaperPlane, faPuzzlePiece } from '#/renderer/src/fontawesome';
import { useActivateSearchHit } from '#/renderer/src/search/activateSearchHit';
import { useSearchIndexes } from '#/renderer/src/search/useSearchIndexes';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  closeSearchAnythingModal,
  selectSearchAnythingModal
} from '#/renderer/src/store/slices/modalsSlice';
import { METHOD_CLASSES } from '#/renderer/src/ui/shared/classes';

/** Element id for the command palette search field. */
const SEARCH_INPUT_ID = 'search-anything-input';

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
  plugin: faPuzzlePiece
};

interface ModalBodyProps {
  /** Dismisses the search anything modal. */
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
          return (
            <li
              key={`${hit.domain}:${hit.id}`}
              role="presentation"
              className="min-w-0"
              onMouseEnter={() => onHighlight(flatIndex)}
            >
              <button
                type="button"
                role="option"
                id={`search-anything-result-${flatIndex}`}
                aria-current={isActive ? 'true' : undefined}
                className={searchResultRowClass(isActive)}
                onClick={() => onActivate(hit)}
              >
                {hit.domain === 'request' && hit.method != null ? (
                  <span className="flex min-w-0 w-full items-center gap-1.5">
                    <span
                      className={`shrink-0 px-1 py-px text-[16px] ${METHOD_CLASSES[hit.method.toLowerCase()] ?? 'text-info'}`}
                    >
                      {hit.method}
                    </span>
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

/**
 * Modal body for the global command palette with debounced unified search.
 */
function SearchAnythingModalBody({ onClose }: ModalBodyProps): JSX.Element {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { searchContext } = useSearchIndexes();
  const activateHit = useActivateSearchHit();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

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
  const hits = useMemo(
    () => searchAll(debouncedQuery, searchContext),
    [debouncedQuery, searchContext]
  );

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
   * Handles keyboard navigation within the result list.
   */
  const handleInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
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
    [activeIndex, handleActivate, hits]
  );

  return (
    <Modal
      label="Search anything"
      onClose={onClose}
      className="flex w-[min(42rem,calc(100vw-2rem))] max-h-[70vh] flex-col self-start overflow-hidden mt-[12vh]"
      overlayClassName="bg-black/35"
    >
      <div className="flex min-w-0 flex-col gap-2 overflow-hidden p-1">
        <label htmlFor={SEARCH_INPUT_ID} className="sr-only">
          Search anything
        </label>
        <Input
          ref={searchInputRef}
          id={SEARCH_INPUT_ID}
          type="search"
          placeholder="Search collections, requests, settings, plugins…"
          value={query}
          className="w-full"
          autoComplete="off"
          aria-controls="search-anything-results"
          aria-expanded={hits.length > 0}
          aria-activedescendant={
            hits.length > 0 ? `search-anything-result-${activeIndex}` : undefined
          }
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleInputKeyDown}
        />

        <div
          id="search-anything-results"
          className="min-w-0 max-h-[min(24rem,50vh)] overflow-x-hidden overflow-y-auto"
          role="region"
          aria-live="polite"
          aria-label="Search results"
        >
          {debouncedQuery.trim().length > 0 && hits.length === 0 ? (
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
export function SearchAnythingModal(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const searchAnything = useAppSelector(selectSearchAnythingModal);

  /**
   * Closes the search anything modal.
   */
  const handleClose = useCallback((): void => {
    dispatch(closeSearchAnythingModal());
  }, [dispatch]);

  if (searchAnything?.open !== true) {
    return null;
  }

  return <SearchAnythingModalBody key="search-anything" onClose={handleClose} />;
}
