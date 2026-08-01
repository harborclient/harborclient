import { FieldError, FormGroup, Input, Select } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { useEffect, useId } from 'react';
import { providerOptionLabel, useProviders } from '#/renderer/src/hooks/useProviders';

interface Props {
  /**
   * Draft live page display name.
   */
  name: string;

  /**
   * Selected storage provider connection id.
   */
  connectionId: string;

  /**
   * Updates the draft name when the user edits the input.
   */
  onNameChange: (name: string) => void;

  /**
   * Updates the selected storage provider.
   */
  onConnectionIdChange: (connectionId: string) => void;

  /**
   * Persists the live page settings form (triggered by Enter in the name field).
   */
  onSave: () => void;

  /**
   * Closes the settings view without saving (triggered by Escape in the name field).
   */
  onClose: () => void;
}

/**
 * Live page name field for the General settings tab.
 */
export function LivePageGeneralSection({
  name,
  connectionId,
  onNameChange,
  onConnectionIdChange,
  onSave,
  onClose
}: Props): JSX.Element {
  const nameId = useId();
  const providerSelectId = useId();
  const {
    providers,
    primaryProviderId,
    loading: providersLoading,
    error: providersError
  } = useProviders(connectionId ? [connectionId] : [], {
    excludeAdminTeamHubs: true,
    excludeLivePageUnsupportedTeamHubs: true,
    excludeGit: true,
    retainConnectionId: connectionId
  });

  /**
   * Defaults newly saved live pages to the active data provider after provider loading completes.
   */
  useEffect(() => {
    if (!connectionId && primaryProviderId) {
      onConnectionIdChange(primaryProviderId);
    }
  }, [connectionId, onConnectionIdChange, primaryProviderId]);

  return (
    <div className="flex flex-col gap-4">
      <FormGroup
        label="Name"
        htmlFor={nameId}
        description="Name shown in the sidebar and when this live page is selected."
      >
        <Input
          id={nameId}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onSave();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              onClose();
            }
          }}
          autoFocus
        />
      </FormGroup>
      <FormGroup label="Storage location" htmlFor={providerSelectId}>
        <Select
          id={providerSelectId}
          value={connectionId || primaryProviderId}
          disabled={providersLoading || providers.length === 0}
          onChange={(event) => onConnectionIdChange(event.target.value)}
        >
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.name || 'Untitled'} ({providerOptionLabel(provider)})
            </option>
          ))}
        </Select>
        {providersError ? <FieldError spacing="field">{providersError}</FieldError> : null}
      </FormGroup>
    </div>
  );
}
