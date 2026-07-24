import { useEffect, useMemo, useState } from 'react';
import type { Variable } from '#/shared/types';
import { buildRuntimeVars, substituteWithMap } from '#/renderer/src/scripting/scriptOrchestration';
import { hostFromUrl } from './cookieHost';

/**
 * Returns whether the cookie jar has any cookies stored for the request URL host.
 *
 * @param url - Request URL (may contain variable placeholders).
 * @param variables - Collection-scoped variables for URL substitution.
 * @returns True when at least one cookie exists for the resolved host.
 */
export function useHasCookies(url: string, variables: Variable[]): boolean {
  /**
   * Resolves the request URL host after variable substitution for cookie lookups.
   */
  const host = useMemo(() => {
    const resolvedUrl = substituteWithMap(url, buildRuntimeVars(variables));
    return hostFromUrl(resolvedUrl);
  }, [url, variables]);

  const [loaded, setLoaded] = useState<{ host: string; hasCookies: boolean } | null>(null);

  /**
   * Fetches cookies for the resolved host and updates the indicator when the host changes.
   */
  useEffect(() => {
    if (!host) return;

    let cancelled = false;

    void window.api
      .getCookies(host)
      .then((cookies) => {
        if (cancelled) return;
        setLoaded({ host, hasCookies: cookies.length > 0 });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.warn(`Failed to load cookies for ${host}:`, err);
        setLoaded({ host, hasCookies: false });
      });

    return () => {
      cancelled = true;
    };
  }, [host]);

  return loaded?.host === host && loaded.hasCookies;
}
