import {
  Button,
  CodeEditor,
  FieldError,
  FormGroup,
  Input,
  Modal,
  ModalFormLayout,
  Select
} from '@harborclient/sdk/components';
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
   * Whether the modal is creating a new snippet.
   */
  isNew: boolean;

  /**
   * True while the save request is in flight.
   */
  saving: boolean;

  /**
   * Inline validation or IPC error message.
   */
  error: string | null;

  /**
   * Updates the draft fields while editing.
   */
  onChange: (draft: SnippetEditDraft) => void;

  /**
   * Closes the modal without saving.
   */
  onCancel: () => void;

  /**
   * Persists the draft snippet.
   */
  onSave: () => void;

  /**
   * When true, shows marketplace snippet source in a read-only preview.
   */
  readOnly?: boolean;

  /**
   * When true, hides the storage-location picker for hub-admin snippet editing.
   */
  hideStorageLocation?: boolean;
}

/**
 * Very large modal for creating or editing a reusable JavaScript snippet.
 */
export function SnippetEditModal({
  draft,
  isNew,
  saving,
  error,
  onChange,
  onCancel,
  onSave,
  readOnly = false,
  hideStorageLocation = false
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

  const title = readOnly ? 'View snippet' : isNew ? 'Add snippet' : 'Edit snippet';
  const description = readOnly
    ? 'Read-only preview of a marketplace snippet. Clone it to make an editable copy.'
    : 'Reusable JavaScript used in pre-request and post-request script lists.';

  return (
    <Modal
      className="flex w-[min(92vw,72rem)] max-h-[85vh] flex-col overflow-hidden"
      labelledBy="snippet-edit-title"
      onClose={onCancel}
      title={title}
      description={description}
      closeDisabled={saving}
      disableEscape={saving}
    >
      <ModalFormLayout
        error={error ? <FieldError spacing="modal">{error}</FieldError> : undefined}
        actions={
          readOnly ? (
            <Button type="button" onClick={onCancel}>
              Close
            </Button>
          ) : (
            <Button type="button" disabled={saving} onClick={() => void onSave()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          )
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[14px] font-medium text-text" htmlFor="snippet-name">
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
            <label className="text-[14px] font-medium text-text" htmlFor="snippet-scope">
              Runs in
            </label>
            <Select
              id="snippet-scope"
              className="w-full"
              value={draft.scope}
              disabled={saving || readOnly}
              onChange={(event) =>
                onChange({ ...draft, scope: event.target.value as SnippetScope })
              }
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
                <p className="mt-1 text-[14px] text-muted">
                  Changing the storage location moves this snippet to the selected database.
                </p>
              ) : null}
            </FormGroup>
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col gap-1">
            <label className="text-[14px] font-medium text-text" htmlFor="snippet-code">
              JavaScript
            </label>
            <CodeEditor
              id="snippet-code"
              value={draft.code}
              readOnly={readOnly}
              onChange={readOnly ? undefined : (code) => onChange({ ...draft, code })}
              language="javascript"
              minHeight="500px"
              placeholder="// hc.variables.set('token', 'abc');"
              aria-labelledby="snippet-code"
            />
          </div>
        </div>
      </ModalFormLayout>
    </Modal>
  );
}
