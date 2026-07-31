import type { JSX } from 'react';
import { FormSection } from '@harborclient/sdk/components';
import type { LiveServerProxy } from '@harborclient/core/types';
import { ProxyList } from './ProxyList';

interface Props {
  /**
   * Ordered reverse-proxy rules from the editor draft.
   */
  proxies: LiveServerProxy[];

  /**
   * When true, disables the list (save/start in flight).
   */
  disabled: boolean;

  /**
   * Called with the full replacement proxy list after any edit.
   *
   * @param next - Updated proxy rows (may include incomplete draft rows).
   */
  onChange: (next: LiveServerProxy[]) => void;
}

/**
 * Proxy tab: ordered path-prefix → upstream URL rules applied before static files.
 *
 * First matching enabled prefix wins. With Strip path on (default), `/api/users`
 * forwarded to `http://127.0.0.1:3000` becomes `http://127.0.0.1:3000/users`.
 * WebSocket upgrades are not forwarded yet.
 *
 * @param props - Proxy rows, disabled flag, and change handler.
 */
export function ProxySettings({ proxies, disabled, onChange }: Props): JSX.Element {
  return (
    <fieldset disabled={disabled} className="m-0 min-w-0 border-0 p-0">
      <FormSection
        title="Reverse proxy"
        description={
          <>
            Rules run before aliases and the document root. Use <code>/</code> or <code>*</code> to
            match all paths; otherwise the path must start with <code>/</code>. Target must be an
            absolute <code>http://</code> or <code>https://</code> URL. Put more specific prefixes
            above shorter ones. WebSocket upgrades are not supported yet.
          </>
        }
      >
        <ProxyList proxies={proxies} disabled={disabled} onChange={onChange} />
      </FormSection>
    </fieldset>
  );
}
