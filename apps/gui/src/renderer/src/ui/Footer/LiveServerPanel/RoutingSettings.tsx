import type { JSX } from 'react';
import { FormSection } from '@harborclient/sdk/components';
import type { LiveServerRoute } from '@harborclient/core/types';
import { RouteList } from './RouteList';

interface Props {
  /**
   * Ordered routing rules from the editor draft.
   */
  routes: LiveServerRoute[];

  /**
   * When true, disables the list (save/start in flight).
   */
  disabled: boolean;

  /**
   * Called with the full replacement route list after any edit.
   *
   * @param next - Updated route rows (may include incomplete draft rows).
   */
  onChange: (next: LiveServerRoute[]) => void;
}

/**
 * Routing tab: ordered match → file/directory rules applied after static miss.
 *
 * First matching enabled rule wins. Use Match `*` and Target `index.html` for
 * Vite/React SPA history fallback without breaking JS/CSS assets.
 *
 * @param props - Route rows, disabled flag, and change handler.
 */
export function RoutingSettings({ routes, disabled, onChange }: Props): JSX.Element {
  return (
    <fieldset disabled={disabled} className="m-0 min-w-0 border-0 p-0">
      <FormSection
        title="Path routing"
        description={
          <>
            Rules run only when no file matched under aliases or the document root (GET/HEAD). Match{' '}
            <code>*</code> catches every remaining path; other values are regexes against the URL
            pathname. Target may be a file (e.g. <code>index.html</code>) or a directory relative to
            the root. Put specific rules above a catch-all.
          </>
        }
      >
        <RouteList routes={routes} disabled={disabled} onChange={onChange} />
      </FormSection>
    </fieldset>
  );
}
