import { CodeEditor, FieldError, FormGroup, Input, Select } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { useEffect, useId } from 'react';
import { SNIPPET_SCOPE_OPTIONS, type SnippetScope } from '#/shared/snippetScope';
import type { SnippetEditDraft } from '#/renderer/src/ui/shared/snippetEditDraft';
import { providerOptionLabel, useProviders } from '#/renderer/src/hooks/useProviders';

interface Props {
  /**
   * Snippet being edited, or a blank draft when creating.
   */
  draft: SnippetEditDraft;

  /**
   * Whether the form is creating a new snippet.
   */
  isNew: boolean;

  /**
   * True while the save request is in flight.
   */
  saving: boolean;

  /**
   * When true, shows marketplace snippet source in a read-only preview.
   */
  readOnly?: boolean;

  /**
   * When true, hides the storage-location picker for hub-admin snippet editing.
   */
  hideStorageLocation?: boolean;

  /**
   * Updates the draft fields while editing.
   */
  onChange: (draft: SnippetEditDraft) => void;
}

/**
 * Reusable snippet create/edit form fields without modal chrome.
 */
export function SnippetEditFields({
  draft,
  isNew,
  saving,
  readOnly = false,
  hideStorageLocation = false,
  onChange
}: Props): JSX.Element {
  const providerSelectId = useId();
  const {
    providers,
    primaryProviderId,
    loading: providersLoading,
    error: providersError
  } = useProviders(draft.connectionId ? [draft.connectionId] : [], {
    excludeAdminTeamHubs: true,
    excludeSnippetUnsupportedTeamHubs: true,
    retainConnectionId: draft.connectionId
  });
  const resolvedProviderId = draft.connectionId ?? primaryProviderId ?? providers[0]?.id ?? '';

  /**
   * Defaults the storage location dropdown to the active database when creating.
   */
  useEffect(() => {
    if (readOnly || hideStorageLocation || draft.connectionId || !primaryProviderId) {
      return;
    }
    onChange({ ...draft, connectionId: primaryProviderId });
  }, [draft, hideStorageLocation, onChange, primaryProviderId, readOnly]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-[16px] font-medium text-text" htmlFor="snippet-name">
          Name
        </label>
        <Input
          id="snippet-name"
          value={draft.name}
          readOnly={readOnly}
          disabled={saving}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          placeholder="Snippet name"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[16px] font-medium text-text" htmlFor="snippet-scope">
          Runs in
        </label>
        <Select
          id="snippet-scope"
          className="w-full"
          value={draft.scope}
          disabled={saving || readOnly}
          onChange={(event) => onChange({ ...draft, scope: event.target.value as SnippetScope })}
        >
          {SNIPPET_SCOPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
      {!readOnly && !hideStorageLocation ? (
        <FormGroup label="Storage location" htmlFor={providerSelectId} labelTone="muted">
          <Select
            id={providerSelectId}
            value={resolvedProviderId}
            disabled={saving || providersLoading || providers.length === 0}
            onChange={(event) => onChange({ ...draft, connectionId: event.target.value })}
          >
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name || 'Untitled'} ({providerOptionLabel(provider)})
              </option>
            ))}
          </Select>
          {providersError ? <FieldError spacing="field">{providersError}</FieldError> : null}
          {!isNew ? (
            <p className="mt-1 text-[16px] text-muted">
              Changing the storage location moves this snippet to the selected database.
            </p>
          ) : null}
        </FormGroup>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col gap-1">
        <label className="text-[16px] font-medium text-text" htmlFor="snippet-code">
          JavaScript
        </label>
        <CodeEditor
          id="snippet-code"
          value={draft.code}
          readOnly={readOnly}
          onChange={readOnly ? undefined : (code) => onChange({ ...draft, code })}
          language="javascript"
          minHeight="500px"
          placeholder="// hc.request.variables.set('token', 'abc');"
          aria-labelledby="snippet-code"
        />
      </div>
    </div>
  );
}
