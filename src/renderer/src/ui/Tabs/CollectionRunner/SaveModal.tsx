import {
  Button,
  FieldError,
  FormGroup,
  Modal,
  ModalFooter,
  Select
} from '@harborclient/sdk/components';
import { useId, useState, type JSX } from 'react';
import {
  isTeamHubProvider,
  providerOptionLabel,
  useProviders
} from '#/renderer/src/hooks/useProviders';

interface Props {
  /**
   * Whether the save destination modal is open.
   */
  open: boolean;

  /**
   * Closes the modal without saving.
   */
  onClose: () => void;

  /**
   * Persists the run result to the selected storage provider.
   *
   * @param connectionId - Provider connection id chosen in the dropdown.
   * @param savedToTeamHub - True when the destination is a Team Hub provider.
   */
  onSave: (connectionId: string, savedToTeamHub: boolean) => void;
}

/**
 * Modal for choosing a storage provider before saving collection run results.
 */
export function SaveModal({ open, onClose, onSave }: Props): JSX.Element | null {
  const providerSelectId = useId();
  const {
    providers,
    primaryProviderId,
    loading: providersLoading,
    error: providersError
  } = useProviders([], { excludeAdminTeamHubs: false });
  const [connectionId, setConnectionId] = useState('');
  const resolvedConnectionId = connectionId || primaryProviderId || providers[0]?.id || '';

  if (!open) {
    return null;
  }

  const canSave = resolvedConnectionId.length > 0 && !providersLoading;

  /**
   * Saves to the selected provider and reports whether it is a Team Hub.
   */
  const handleSave = (): void => {
    if (!canSave) {
      return;
    }

    onSave(resolvedConnectionId, isTeamHubProvider(providers, resolvedConnectionId));
  };

  return (
    <Modal
      onClose={() => {
        setConnectionId('');
        onClose();
      }}
      labelledBy="collection-runner-save-title"
      title="Save run results"
      description="Choose where to store this run snapshot. Team Hub saves can be shared with a link."
    >
      <FormGroup label="Storage location" htmlFor={providerSelectId}>
        <Select
          id={providerSelectId}
          className="w-full cursor-pointer py-1"
          value={resolvedConnectionId}
          disabled={providersLoading || providers.length === 0}
          onChange={(event) => setConnectionId(event.target.value)}
          aria-label="Storage location for saved run results"
        >
          {providers.length === 0 ? (
            <option value="">No providers configured</option>
          ) : (
            providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name} ({providerOptionLabel(provider)})
              </option>
            ))
          )}
        </Select>
      </FormGroup>

      {providersError ? (
        <FieldError spacing="section">Failed to load providers: {providersError}</FieldError>
      ) : null}

      <ModalFooter spaced>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" disabled={!canSave} onClick={handleSave}>
          Save
        </Button>
      </ModalFooter>
    </Modal>
  );
}
