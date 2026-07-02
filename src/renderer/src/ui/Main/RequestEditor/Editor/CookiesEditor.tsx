import { KeyValueEditor } from '@harborclient/sdk/components';
import { useEffect, useMemo, useState, type JSX } from 'react';
import type { KeyValue, Variable } from '#/shared/types';

import { emptyKeyValue } from '#/renderer/src/store/drafts';
import { buildRuntimeVars, substituteWithMap } from '#/renderer/src/scripting/scriptOrchestration';
import { cookieKeySource, cookieValueSource } from '#/renderer/src/autocomplete/sources';
import { hostFromUrl } from './cookieHost';

interface Props {
  /**
   * Request URL used to resolve the cookie domain.
   */
  url: string;

  /**
   * Collection-scoped variables for URL substitution.
   */
  variables: Variable[];
}

/**
 * Editable cookie list for the request URL host, backed by the main-process jar.
 */
export function CookiesEditor({ url, variables }: Props): JSX.Element {
  /**
   * Resolves the request URL host after variable substitution for cookie storage.
   */
  const host = useMemo(() => {
    const resolvedUrl = substituteWithMap(url, buildRuntimeVars(variables));
    return hostFromUrl(resolvedUrl);
  }, [url, variables]);

  const [rows, setRows] = useState<KeyValue[]>([emptyKeyValue()]);
  const [loadedHost, setLoadedHost] = useState<string | null>(null);
  const loading = host !== null && loadedHost !== host;

  /**
   * Loads cookies for the resolved host whenever the URL changes.
   */
  useEffect(() => {
    if (!host) return;

    let cancelled = false;

    void window.api
      .getCookies(host)
      .then((cookies) => {
        if (cancelled) return;
        setRows(cookies.length ? cookies : [emptyKeyValue()]);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.warn(`Failed to load cookies for ${host}:`, err);
        setRows([emptyKeyValue()]);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadedHost(host);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [host]);

  /**
   * Updates local state and persists cookies for the current host.
   *
   * @param nextRows - Updated cookie rows.
   */
  const handleChange = (nextRows: KeyValue[]): void => {
    setRows(nextRows);
    if (!host) return;
    void window.api.setCookies(host, nextRows).catch((err: unknown) => {
      console.warn(`Failed to save cookies for ${host}:`, err);
    });
  };

  if (!host) {
    return <p className="text-[14px] text-muted">Enter a valid URL to manage cookies.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-[16px] text-muted mb-2 border border-separator p-4">
        Cookies for <span className="font-medium text-text">{host}</span>
      </p>
      {loading ? (
        <p className="text-[14px] text-muted">Loading cookies…</p>
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
