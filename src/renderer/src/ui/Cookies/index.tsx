import {
  Button,
  FieldError,
  FormGroup,
  Input,
  Page,
  SidebarLayout
} from '@harborclient/sdk/components';
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type JSX } from 'react';
import { faCookieBite } from '#/renderer/src/fontawesome';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { hostFromUrl } from '#/renderer/src/ui/Main/RequestEditor/Editor/cookieHost';
import { toolbarDangerButtonClass } from '#/renderer/src/ui/shared/classes';
import { DomainCookiesEditor } from './DomainCookiesEditor';

const addDomainInputId = 'cookies-add-domain';
const addDomainErrorId = 'cookies-add-domain-error';

/**
 * Returns whether cookie rows contain a persisted name/value pair.
 *
 * @param rows - Cookie rows from the key/value editor.
 * @returns True when at least one row has a key or value.
 */
function hasPersistedCookieRows(rows: { key: string; value: string }[]): boolean {
  return rows.some((row) => row.key.trim() || row.value.trim());
}

/**
 * Full-page manager for saved cookies across every persisted domain.
 */
export function Cookies(): JSX.Element {
  const confirm = useConfirm();
  const [domains, setDomains] = useState<string[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [draftDomain, setDraftDomain] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [addingDomain, setAddingDomain] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newDomainError, setNewDomainError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Refreshes the persisted domain list after cookie jar mutations.
   *
   * @returns The latest persisted domain list.
   */
  const refreshDomains = useCallback(async (): Promise<string[]> => {
    setLoading(true);
    setError(null);
    try {
      const nextDomains = await window.api.listCookieDomains();
      setDomains(nextDomains);
      return nextDomains;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load cookie domains';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Loads cookie domains when the page opens and selects the first saved domain.
   */
  useEffect(() => {
    let cancelled = false;

    /**
     * Reads persisted cookie domains for the initial page render.
     */
    const loadInitialDomains = async (): Promise<void> => {
      try {
        const nextDomains = await window.api.listCookieDomains();
        if (cancelled) return;
        setDomains(nextDomains);
        if (nextDomains.length > 0) {
          setSelectedDomain((currentDomain) => currentDomain ?? nextDomains[0]);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load cookie domains';
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadInitialDomains();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Derives the sidebar domain list, including an unsaved draft domain while it is being edited.
   */
  const visibleDomains = useMemo(() => {
    const nextDomains = new Set(domains);
    if (draftDomain) {
      nextDomains.add(draftDomain);
    }
    return Array.from(nextDomains).sort();
  }, [domains, draftDomain]);

  /**
   * Filters domain rows by the search query without mutating the persisted order.
   */
  const filteredDomains = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return visibleDomains;
    return visibleDomains.filter((domain) => domain.includes(query));
  }, [visibleDomains, searchQuery]);

  /**
   * Updates the sidebar search query.
   *
   * @param event - Search input change event.
   */
  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setSearchQuery(event.target.value);
  };

  /**
   * Updates the add-domain form value and clears stale validation copy.
   *
   * @param event - Domain input change event.
   */
  const handleNewDomainChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setNewDomain(event.target.value);
    setNewDomainError(null);
  };

  /**
   * Shows or hides the add-domain form.
   */
  const handleToggleAddDomain = (): void => {
    setAddingDomain((nextAddingDomain) => !nextAddingDomain);
    setNewDomain('');
    setNewDomainError(null);
  };

  /**
   * Selects a domain from the sidebar.
   *
   * @param domain - Domain row selected by the user.
   */
  const handleSelectDomain = (domain: string): void => {
    setSelectedDomain(domain);
  };

  /**
   * Validates and selects a new domain before any cookies are saved for it.
   */
  const handleAddDomain = (): void => {
    const domain = hostFromUrl(newDomain)?.toLowerCase() ?? null;
    if (!domain) {
      setNewDomainError('Enter a valid domain or URL.');
      return;
    }

    setDraftDomain(domains.includes(domain) ? null : domain);
    setSelectedDomain(domain);
    setAddingDomain(false);
    setNewDomain('');
    setNewDomainError(null);
  };

  /**
   * Refreshes domains after cookie saves and clears empty draft domains.
   *
   * @param rows - Rows saved by the domain editor.
   */
  const handleCookiesSaved = (rows: { key: string; value: string }[]): void => {
    const hasRows = hasPersistedCookieRows(rows);
    if (hasRows) {
      setDraftDomain(null);
    } else {
      setDraftDomain(null);
      setSelectedDomain(null);
    }
    void refreshDomains().then((nextDomains) => {
      if (!hasRows && nextDomains.length > 0) {
        setSelectedDomain(nextDomains[0]);
      }
    });
  };

  /**
   * Deletes all cookies for the selected domain after confirmation.
   */
  const handleDeleteDomain = async (): Promise<void> => {
    if (!selectedDomain) return;

    const confirmed = await confirm({
      title: 'Delete cookie domain?',
      message: `Delete all saved cookies for ${selectedDomain}? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger'
    });
    if (!confirmed) return;

    try {
      await window.api.setCookies(selectedDomain, []);
      setDraftDomain(null);
      setSelectedDomain(null);
      const nextDomains = await refreshDomains();
      setSelectedDomain(nextDomains[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete cookie domain');
    }
  };

  const selectedDomainIsSaved = selectedDomain != null && domains.includes(selectedDomain);

  return (
    <SidebarLayout
      sidebar={
        <aside className="flex h-full w-[300px] shrink-0 flex-col border-r border-separator bg-sidebar">
          <div className="flex flex-col gap-3 border-b border-separator p-3">
            <FormGroup
              className="border-none! p-0!"
              label="Search cookie domains"
              htmlFor="cookies-domain-search"
              srOnly
            >
              <Input
                id="cookies-domain-search"
                type="search"
                placeholder="Search domains"
                value={searchQuery}
                className="w-full"
                onChange={handleSearchChange}
              />
            </FormGroup>

            <Button type="button" variant="secondary" onClick={handleToggleAddDomain}>
              {addingDomain ? 'Cancel' : 'Add domain'}
            </Button>

            {addingDomain ? (
              <div className="flex flex-col gap-2">
                <FormGroup label="Domain" htmlFor={addDomainInputId}>
                  <Input
                    id={addDomainInputId}
                    type="text"
                    placeholder="example.com"
                    value={newDomain}
                    aria-invalid={newDomainError ? true : undefined}
                    aria-describedby={newDomainError ? addDomainErrorId : undefined}
                    onChange={handleNewDomainChange}
                  />
                </FormGroup>
                {newDomainError ? (
                  <FieldError id={addDomainErrorId}>{newDomainError}</FieldError>
                ) : null}
                <Button type="button" disabled={!newDomain.trim()} onClick={handleAddDomain}>
                  Manage domain
                </Button>
              </div>
            ) : null}
          </div>

          <nav
            className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2"
            aria-label="Cookie domains"
          >
            {loading && visibleDomains.length === 0 ? (
              <p className="m-0 px-1.5 py-1 text-[14px] text-muted" role="status">
                Loading cookie domains...
              </p>
            ) : null}

            {!loading && filteredDomains.length === 0 ? (
              <p className="m-0 px-1.5 py-1 text-[14px] text-muted">
                {visibleDomains.length === 0
                  ? 'No saved cookie domains yet.'
                  : 'No matching domains.'}
              </p>
            ) : null}

            {filteredDomains.map((domain) => {
              const active = selectedDomain === domain;
              return (
                <button
                  key={domain}
                  type="button"
                  className={`w-full rounded-md border-none px-2 py-1 text-left text-[15px] app-no-drag ${
                    active
                      ? 'bg-selection text-text'
                      : 'bg-transparent text-muted hover:bg-hover hover:text-text'
                  }`}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => handleSelectDomain(domain)}
                >
                  <span className="block truncate">{domain}</span>
                </button>
              );
            })}
          </nav>
        </aside>
      }
    >
      <Page
        embedded
        title={selectedDomain ?? 'Cookies'}
        description="Manage saved cookies for every domain HarborClient has captured or that you add manually."
        icon={faCookieBite}
        actions={
          selectedDomain ? (
            <Button
              type="button"
              variant="toolbar"
              className={toolbarDangerButtonClass}
              disabled={!selectedDomainIsSaved && selectedDomain !== draftDomain}
              onClick={() => void handleDeleteDomain()}
            >
              Delete domain
            </Button>
          ) : null
        }
      >
        {error ? <FieldError spacing="section">{error}</FieldError> : null}

        {selectedDomain ? (
          <DomainCookiesEditor domain={selectedDomain} onSaved={handleCookiesSaved} />
        ) : (
          <p className="text-[14px] text-muted">Select or add a domain to manage its cookies.</p>
        )}
      </Page>
    </SidebarLayout>
  );
}
