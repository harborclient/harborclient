import { useCallback, useId, useState, type FormEvent, type JSX } from 'react';
import type { ApisIoCollection } from '@harborclient/core/apisio/catalog';
import { Button, FieldError, FormGroup, Input, StatusMessage } from '@harborclient/sdk/components';
import { formatErrorMessage } from '#/renderer/src/ui/Modals/dialogHelpers';

import { DetailModal } from './DetailModal';
import { ResultItem } from './ResultItem';

/**
 * Public collections tab: search apis.io and import matching Open/Postman collections.
 */
export function PublicCollectionsTabPanel(): JSX.Element {
  const searchId = useId();
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [results, setResults] = useState<ApisIoCollection[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ApisIoCollection | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  /**
   * Runs a catalog search for the given page, replacing or appending results.
   *
   * @param searchQuery - Free-text query to send to apis.io.
   * @param nextPage - 1-based page to fetch.
   * @param append - When true, appends to existing results instead of replacing.
   */
  const runSearch = useCallback(
    async (searchQuery: string, nextPage: number, append: boolean): Promise<void> => {
      const trimmed = searchQuery.trim();
      if (!trimmed) {
        setError('Enter a search query.');
        return;
      }

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const response = await window.api.searchPublicCollections(trimmed, nextPage);
        setSubmittedQuery(trimmed);
        setHasSearched(true);
        setPage(response.meta.page);
        setTotalPages(response.meta.pages);
        setTotal(response.meta.total);
        setResults((prev) => (append ? [...prev, ...response.data] : response.data));
      } catch (err) {
        setError(formatErrorMessage(err, 'Failed to search public collections'));
        if (!append) {
          setResults([]);
          setTotalPages(0);
          setTotal(0);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  /**
   * Handles the search form submit for a fresh first-page query.
   *
   * @param event - Form submit event.
   */
  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>): void => {
      event.preventDefault();
      void runSearch(query, 1, false);
    },
    [query, runSearch]
  );

  /**
   * Fetches the next page of results for the last submitted query.
   */
  const handleLoadMore = useCallback((): void => {
    void runSearch(submittedQuery, page + 1, true);
  }, [page, runSearch, submittedQuery]);

  const canLoadMore = hasSearched && page < totalPages && !loading && !loadingMore;

  return (
    <div className="flex min-h-[18rem] flex-col gap-4">
      <p className="m-0 text-muted">
        Search the{' '}
        <a
          href="https://apis.io/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent"
        >
          apis.io
        </a>{' '}
        catalog for public Open Collections and Postman Collections, then import one into
        HarborClient.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <FormGroup
          label="Search public collections"
          htmlFor={searchId}
          labelTone="muted"
          bordered={false}
          className="mb-0 min-w-0 flex-1"
        >
          <Input
            id={searchId}
            className="w-full"
            type="search"
            autoFocus
            value={query}
            placeholder="e.g. forms, stripe, github"
            onChange={(event) => setQuery(event.target.value)}
          />
        </FormGroup>
        <Button type="submit" disabled={loading || !query.trim()} className="shrink-0">
          {loading ? 'Searching…' : 'Search'}
        </Button>
      </form>

      {error ? (
        <FieldError spacing="section" className="mb-0 mt-0">
          {error}
        </FieldError>
      ) : null}

      {loading ? (
        <StatusMessage live className="mb-0">
          Searching apis.io…
        </StatusMessage>
      ) : null}

      {!loading && hasSearched && results.length === 0 && !error ? (
        <StatusMessage live={false} className="mb-0">
          No public collections matched “{submittedQuery}”.
        </StatusMessage>
      ) : null}

      {!loading && results.length > 0 ? (
        <>
          <StatusMessage live className="mb-0">
            {total} {total === 1 ? 'result' : 'results'}
            {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ''}
          </StatusMessage>
          <ul
            className="m-0 flex list-none flex-col gap-2 p-0"
            aria-label="Public collection results"
          >
            {results.map((item) => (
              <ResultItem
                key={`${item.provider_slug}:${item.slug}`}
                item={item}
                onSelect={setSelected}
              />
            ))}
          </ul>
          {canLoadMore ? (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="secondary"
                disabled={loadingMore}
                onClick={handleLoadMore}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}

      {selected ? (
        <DetailModal
          key={`${selected.provider_slug}:${selected.slug}`}
          item={selected}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
