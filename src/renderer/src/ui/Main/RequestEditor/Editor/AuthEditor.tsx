import {
  Button,
  FormGroup,
  Select,
  VariableInput,
  fieldFrame,
  CodeEditor
} from '@harborclient/sdk/components';
import { useState, type JSX } from 'react';
import type { AuthConfig, AuthType, Variable } from '#/shared/types';
import { buildOAuthAuthHeaderValue } from '#/shared/auth';

interface Props {
  /**
   * Current authorization settings.
   */
  auth: AuthConfig;

  /**
   * Called when auth type or credential fields change.
   *
   * @param auth - Updated authorization settings.
   */
  onChange: (auth: AuthConfig) => void;

  /**
   * Collection-scoped variables for highlighting and tooltips.
   */
  variables: Variable[];

  /**
   * Opens collection settings to edit variables.
   */
  onEditVariables?: () => void;

  /**
   * Stable cache key for OAuth token storage on saved requests or collections.
   */
  oauthCacheKey?: string;
}

/**
 * Two-pane authorization editor with auth type selection and credential fields.
 */
export function AuthEditor({
  auth,
  onChange,
  variables,
  onEditVariables,
  oauthCacheKey
}: Props): JSX.Element {
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [oauthStatus, setOauthStatus] = useState<string | null>(null);

  /**
   * Updates the selected auth type while preserving entered credential values.
   *
   * @param type - New auth type from the dropdown.
   */
  const handleTypeChange = (type: AuthType): void => {
    onChange({ ...auth, type });
    setOauthError(null);
    setOauthStatus(null);
  };

  /**
   * Fetches an OAuth 2.0 access token using the configured Client Credentials grant.
   *
   * @param force - When true, bypass cache and request a fresh token.
   */
  const handleFetchOAuthToken = async (force: boolean): Promise<void> => {
    setOauthLoading(true);
    setOauthError(null);
    setOauthStatus(null);

    try {
      const result = await window.api.oauthFetchToken(oauthCacheKey ?? '', auth.oauth2, force);
      const headerValue = buildOAuthAuthHeaderValue(result);
      if (!headerValue) {
        throw new Error('OAuth token response contained an invalid access token.');
      }

      const expiryText = result.expiresAt
        ? ` Expires ${new Date(result.expiresAt).toLocaleString()}.`
        : '';
      setOauthStatus(`Token acquired.${expiryText}`);
    } catch (err) {
      setOauthError(err instanceof Error ? err.message : String(err));
    } finally {
      setOauthLoading(false);
    }
  };

  /**
   * Clears any cached OAuth access token for this request or collection.
   */
  const handleClearOAuthToken = async (): Promise<void> => {
    if (!oauthCacheKey) {
      setOauthStatus('No cached token to clear for unsaved requests.');
      setOauthError(null);
      return;
    }

    setOauthLoading(true);
    setOauthError(null);
    setOauthStatus(null);

    try {
      await window.api.oauthClearToken(oauthCacheKey);
      setOauthStatus('Cached token cleared.');
    } catch (err) {
      setOauthError(err instanceof Error ? err.message : String(err));
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="shrink-0 w-full mb-4">
        <FormGroup label="Auth Type" htmlFor="auth-type" labelTone="muted">
          <Select
            id="auth-type"
            className="w-full"
            value={auth.type}
            onChange={(event) => handleTypeChange(event.target.value as AuthType)}
          >
            <option value="none">None</option>
            <option value="basic">Basic Auth</option>
            <option value="bearer">Bearer Token</option>
            <option value="oauth2">OAuth 2.0</option>
          </Select>
        </FormGroup>
      </div>

      <div className="min-w-0 flex-1">
        {auth.type === 'none' && (
          <p className="m-0 text-[16px] text-muted border border-separator p-4">
            No request-level authorization is configured. Collection authorization applies when set.
          </p>
        )}

        {auth.type === 'basic' && (
          <div className="flex flex-col gap-3">
            <div>
              <FormGroup label="Username" htmlFor="auth-username" labelTone="muted">
                <VariableInput
                  id="auth-username"
                  wrapperClassName={`${fieldFrame} w-full`}
                  value={auth.basic.username}
                  onChange={(username) => onChange({ ...auth, basic: { ...auth.basic, username } })}
                  variables={variables}
                  onEditVariable={onEditVariables}
                  placeholder="username"
                  className="app-no-drag"
                />
              </FormGroup>
            </div>
            <div>
              <FormGroup label="Password" htmlFor="auth-password" labelTone="muted">
                <VariableInput
                  id="auth-password"
                  wrapperClassName={`${fieldFrame} w-full`}
                  value={auth.basic.password}
                  onChange={(password) => onChange({ ...auth, basic: { ...auth.basic, password } })}
                  variables={variables}
                  onEditVariable={onEditVariables}
                  placeholder="password"
                  className="app-no-drag"
                />
              </FormGroup>
            </div>
          </div>
        )}

        {auth.type === 'bearer' && (
          <div>
            <FormGroup label="Token" htmlFor="auth-token" labelTone="muted">
              <CodeEditor
                id="auth-token"
                value={auth.bearer.token}
                onChange={(token) => onChange({ ...auth, bearer: { token } })}
                language="text"
                placeholder="Bearer token"
                variables={variables}
                onEditVariable={onEditVariables}
                minHeight="120px"
              />
            </FormGroup>
          </div>
        )}

        {auth.type === 'oauth2' && (
          <div className="flex flex-col gap-3">
            <div>
              <FormGroup label="Token URL" htmlFor="auth-oauth-token-url" labelTone="muted">
                <VariableInput
                  id="auth-oauth-token-url"
                  wrapperClassName={`${fieldFrame} w-full`}
                  value={auth.oauth2.tokenUrl}
                  onChange={(tokenUrl) =>
                    onChange({ ...auth, oauth2: { ...auth.oauth2, tokenUrl } })
                  }
                  variables={variables}
                  onEditVariable={onEditVariables}
                  placeholder="https://example.com/oauth/token"
                  className="app-no-drag"
                />
              </FormGroup>
            </div>
            <div>
              <FormGroup label="Client ID" htmlFor="auth-oauth-client-id" labelTone="muted">
                <VariableInput
                  id="auth-oauth-client-id"
                  wrapperClassName={`${fieldFrame} w-full`}
                  value={auth.oauth2.clientId}
                  onChange={(clientId) =>
                    onChange({ ...auth, oauth2: { ...auth.oauth2, clientId } })
                  }
                  variables={variables}
                  onEditVariable={onEditVariables}
                  placeholder="client id"
                  className="app-no-drag"
                />
              </FormGroup>
            </div>
            <div>
              <FormGroup label="Client Secret" htmlFor="auth-oauth-client-secret" labelTone="muted">
                <VariableInput
                  id="auth-oauth-client-secret"
                  wrapperClassName={`${fieldFrame} w-full`}
                  value={auth.oauth2.clientSecret}
                  onChange={(clientSecret) =>
                    onChange({ ...auth, oauth2: { ...auth.oauth2, clientSecret } })
                  }
                  variables={variables}
                  onEditVariable={onEditVariables}
                  placeholder="client secret"
                  className="app-no-drag"
                />
              </FormGroup>
            </div>
            <div>
              <FormGroup label="Scope" htmlFor="auth-oauth-scope" labelTone="muted">
                <VariableInput
                  id="auth-oauth-scope"
                  wrapperClassName={`${fieldFrame} w-full`}
                  value={auth.oauth2.scope}
                  onChange={(scope) => onChange({ ...auth, oauth2: { ...auth.oauth2, scope } })}
                  variables={variables}
                  onEditVariable={onEditVariables}
                  placeholder="read write"
                  className="app-no-drag"
                />
              </FormGroup>
            </div>
            <div>
              <FormGroup label="Audience" htmlFor="auth-oauth-audience" labelTone="muted">
                <VariableInput
                  id="auth-oauth-audience"
                  wrapperClassName={`${fieldFrame} w-full`}
                  value={auth.oauth2.audience}
                  onChange={(audience) =>
                    onChange({ ...auth, oauth2: { ...auth.oauth2, audience } })
                  }
                  variables={variables}
                  onEditVariable={onEditVariables}
                  placeholder="optional audience"
                  className="app-no-drag"
                />
              </FormGroup>
            </div>
            <div>
              <FormGroup
                label="Client Authentication"
                htmlFor="auth-oauth-client-auth"
                labelTone="muted"
              >
                <Select
                  id="auth-oauth-client-auth"
                  className="w-full"
                  value={auth.oauth2.clientAuth}
                  onChange={(event) =>
                    onChange({
                      ...auth,
                      oauth2: {
                        ...auth.oauth2,
                        clientAuth: event.target.value as AuthConfig['oauth2']['clientAuth']
                      }
                    })
                  }
                >
                  <option value="body">Send as request body</option>
                  <option value="header">Send as Basic Auth header</option>
                </Select>
              </FormGroup>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={oauthLoading}
                onClick={() => void handleFetchOAuthToken(true)}
              >
                Get Token
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={oauthLoading || !oauthCacheKey}
                onClick={() => void handleClearOAuthToken()}
              >
                Clear Token
              </Button>
            </div>
            {oauthError && (
              <p className="m-0 text-[14px] text-danger" role="alert">
                {oauthError}
              </p>
            )}
            {oauthStatus && (
              <p className="m-0 text-[14px] text-muted" role="status" aria-live="polite">
                {oauthStatus}
              </p>
            )}
            {!oauthCacheKey && (
              <p className="m-0 text-[14px] text-muted">
                Save this request to cache tokens between sends. Unsaved requests fetch a fresh
                token on each send.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
