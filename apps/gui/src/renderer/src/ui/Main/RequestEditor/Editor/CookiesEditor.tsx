import { useMemo, type JSX } from 'react';
import type { Variable } from '#/shared/types';
import { buildRuntimeVars, substituteWithMap } from '#/renderer/src/scripting/scriptOrchestration';
import { DomainCookiesEditor } from '#/renderer/src/ui/Tabs/Cookies/DomainCookiesEditor';
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

  if (!host) {
    return <p className="text-[14px] text-muted">Enter a valid URL to manage cookies.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-muted mb-2 border border-separator p-4">
        Cookies for <span className="font-medium text-text">{host}</span>
      </p>
      <DomainCookiesEditor domain={host} variables={variables} />
    </div>
  );
}
