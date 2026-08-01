import type { JSX } from 'react';
import { FormSection } from '@harborclient/sdk/components';
import type { LiveServerErrorPage, LiveServerRoute } from '@harborclient/core/types';
import { ErrorPageList } from './ErrorPageList';
import { RouteList } from './RouteList';

interface Props {
  /**
   * Ordered routing rules from the editor draft.
   */
  routes: LiveServerRoute[];

  /**
   * Status-code → HTML file mappings from the editor draft.
   */
  errorPages: LiveServerErrorPage[];

  /**
   * Document root used as the default path for error-page Browse dialogs.
   */
  root: string;

  /**
   * When true, disables the lists (save/start in flight).
   */
  disabled: boolean;

  /**
   * Called with the full replacement route list after any edit.
   *
   * @param next - Updated route rows (may include incomplete draft rows).
   */
  onChange: (next: LiveServerRoute[]) => void;

  /**
   * Called with the full replacement error-page list after any edit.
   *
   * @param next - Updated error-page rows (may include a trailing blank row).
   */
  onErrorPagesChange: (next: LiveServerErrorPage[]) => void;
}

/**
 * Routing tab: ordered path-match rules plus custom HTML error pages.
 *
 * Path rules run after alias/document-root static miss (GET/HEAD). Error pages
 * replace plaintext bodies when the server would return status ≥ 400.
 *
 * @param props - Route/error-page rows, root, disabled flag, and change handlers.
 */
export function RoutingSettings({
  routes,
  errorPages,
  root,
  disabled,
  onChange,
  onErrorPagesChange
}: Props): JSX.Element {
  return (
    <fieldset disabled={disabled} className="m-0 flex min-w-0 flex-col gap-6 border-0 p-0">
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

      <FormSection
        title="Error pages"
        description={
          <>
            When the server would return status ≥ 400, serve the matching HTML file instead of the
            default plaintext body. Codes may be exact (<code>404</code>), a decade (
            <code>40x</code> for 400–409), or a class (<code>4xx</code>). Most specific match wins.
            Paths are absolute or relative to the document root.
          </>
        }
      >
        <ErrorPageList
          errorPages={errorPages}
          disabled={disabled}
          root={root}
          onChange={onErrorPagesChange}
        />
      </FormSection>
    </fieldset>
  );
}
