import type { JSX } from 'react';
import type { AuthConfig, Variable } from '#/shared/types';
import { AuthEditor } from '#/renderer/src/ui/Main/RequestEditor/Editor/AuthEditor';

interface Props {
  /**
   * Default authorization settings for the folder.
   */
  auth: AuthConfig;

  /**
   * Folder id used for OAuth token cache keys.
   */
  folderId: number;

  /**
   * Folder-scoped variables for highlighting and tooltips.
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
 * Folder authorization editor for the Authorization tab.
 */
export function AuthSection({ auth, folderId, variables, onChange }: Props): JSX.Element {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <span className="text-[18px] text-muted">Authorization</span>
      <p className="hc-form-group-description m-0 text-[14px] text-muted mb-2">
        Default authorization for every request in this folder. Requests can override these settings
        on their Authorization tab. Values support {'{{variable}}'} syntax.
      </p>
      <AuthEditor
        auth={auth}
        onChange={onChange}
        variables={variables}
        oauthCacheKey={`folder:${folderId}`}
      />
    </div>
  );
}
