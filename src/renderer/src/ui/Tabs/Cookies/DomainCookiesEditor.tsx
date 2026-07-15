import { KeyValueEditor } from '@harborclient/sdk/components';
import { useEffect, useState, type JSX } from 'react';
import type { KeyValue, Variable } from '#/shared/types';
import { cookieKeySource, cookieValueSource } from '#/renderer/src/autocomplete/sources';
import { emptyKeyValue } from '#/renderer/src/store/tabs';

interface Props {
  /**
   * Hostname whose cookies should be loaded and persisted.
   */
  domain: string;

  /**
   * Variables available to the key/value editor autocomplete.
   */
  variables?: Variable[];

  /**
   * Called after a successful save so parent lists can refresh domain state.
   */
  onSaved?: (rows: KeyValue[]) => void;
}

/**
 * Edits saved cookies for a single domain using the shared main-process jar.
 */
export function DomainCookiesEditor({ domain, variables = [], onSaved }: Props): JSX.Element {
  const [rows, setRows] = useState<KeyValue[]>([emptyKeyValue()]);
  const [loadedDomain, setLoadedDomain] = useState<string | null>(null);
  const loading = loadedDomain !== domain;

  /**
   * Loads cookie rows whenever the selected domain changes.
   */
  useEffect(() => {
    let cancelled = false;

    void window.api
      .getCookies(domain)
      .then((cookies) => {
        if (cancelled) return;
        setRows(cookies.length ? cookies : [emptyKeyValue()]);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.warn(`Failed to load cookies for ${domain}:`, err);
        setRows([emptyKeyValue()]);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadedDomain(domain);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [domain]);

  /**
   * Updates local rows and persists them to the selected domain.
   *
   * @param nextRows - Updated cookie rows from the key/value editor.
   */
  const handleChange = (nextRows: KeyValue[]): void => {
    setRows(nextRows);
    void window.api
      .setCookies(domain, nextRows)
      .then(() => {
        onSaved?.(nextRows);
      })
      .catch((err: unknown) => {
        console.warn(`Failed to save cookies for ${domain}:`, err);
      });
  };

  return (
    <div className="flex flex-col gap-2">
      {loading ? (
        <p className="text-[14px] text-muted" role="status">
          Loading cookies...
        </p>
      ) : (
        <KeyValueEditor
          rows={rows}
          onChange={handleChange}
          placeholderKey="name"
          placeholderValue="value"
          variables={variables}
          keySource={cookieKeySource}
          valueSource={cookieValueSource}
        />
      )}
    </div>
  );
}
