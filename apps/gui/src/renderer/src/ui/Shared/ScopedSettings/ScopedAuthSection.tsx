import { FormSection } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { Variable } from '@harborclient/core/types';
import type { AuthConfig } from '@harborclient/core/auth';
import { AuthEditor } from '#/renderer/src/ui/Main/RequestEditor/Editor/AuthEditor';

type Scope = 'collection' | 'folder' | 'website';

interface Props {
  /**
   * Whether authorization applies at collection, folder, or website scope.
   */
  scope: Scope;

  /**
   * Collection, folder, or website id used for OAuth token cache keys.
   */
  id: number | string;

  /**
   * Default authorization settings for the scoped container.
   */
  auth: AuthConfig;

  /**
   * Scoped variables for highlighting and tooltips.
   */
  variables: Variable[];

  /**
   * Called when authorization settings change.
   *
   * @param auth - Updated authorization settings.
   */
  onChange: (auth: AuthConfig) => void;
}

/**
 * Returns the Authorization tab description for the given scope.
 *
 * @param scope - Settings scope.
 * @returns Description content for the FormSection.
 */
function authDescription(scope: Scope): JSX.Element {
  if (scope === 'website') {
    return (
      <>
        Authorization applied to chrome-driven live page navigations. Basic and Bearer produce an
        Authorization header unless a manual Authorization header is set on the Headers tab. Values
        support {'{{variable}}'} syntax.
      </>
    );
  }
  return (
    <>
      Default authorization for every request in this {scope}. Requests can override these settings
      on their Authorization tab. Values support {'{{variable}}'} syntax.
    </>
  );
}

/**
 * Authorization editor for collection, folder, or live page settings tabs.
 */
export function ScopedAuthSection({ scope, id, auth, variables, onChange }: Props): JSX.Element {
  return (
    <FormSection title="Authorization" description={authDescription(scope)}>
      <AuthEditor
        auth={auth}
        onChange={onChange}
        variables={variables}
        oauthCacheKey={`${scope}:${id}`}
      />
    </FormSection>
  );
}
