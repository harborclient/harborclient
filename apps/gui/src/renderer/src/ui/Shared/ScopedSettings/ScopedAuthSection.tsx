import { FormSection } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { AuthConfig, Variable } from '#/shared/types';
import { AuthEditor } from '#/renderer/src/ui/Main/RequestEditor/Editor/AuthEditor';

type Scope = 'collection' | 'folder';

interface Props {
  /**
   * Whether authorization applies at collection or folder scope.
   */
  scope: Scope;

  /**
   * Collection or folder id used for OAuth token cache keys.
   */
  id: number;

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
 * Authorization editor for collection or folder settings tabs.
 */
export function ScopedAuthSection({ scope, id, auth, variables, onChange }: Props): JSX.Element {
  return (
    <FormSection
      title="Authorization"
      description={
        <>
          Default authorization for every request in this {scope}. Requests can override these
          settings on their Authorization tab. Values support {'{{variable}}'} syntax.
        </>
      }
    >
      <AuthEditor
        auth={auth}
        onChange={onChange}
        variables={variables}
        oauthCacheKey={`${scope}:${id}`}
      />
    </FormSection>
  );
}
