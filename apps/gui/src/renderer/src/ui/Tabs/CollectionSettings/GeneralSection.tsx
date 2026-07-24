import { ErrorRetry, FormGroup, Input, LoadingMessage, Select } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { useId } from 'react';
import type { ProviderOption } from '#/renderer/src/hooks/useProviders';
import { providerOptionLabel } from '#/renderer/src/hooks/useProviders';
import { COLLECTION_SETTINGS_NAME_INPUT_ID } from './focusCollectionSettings';

interface Props {
  /**
   * Draft collection display name shown in the name field.
   */
  name: string;

  /**
   * Updates the draft name when the user edits the input.
   */
  onNameChange: (name: string) => void;

  /**
   * Selected provider connection id for the collection database.
   */
  connectionId: string;

  /**
   * Available provider options for the provider select.
   */
  providers: ProviderOption[];

  /**
   * Updates the draft connection id when the user picks a provider.
   */
  onConnectionIdChange: (connectionId: string) => void;

  /**
   * True while providers are loading from IPC.
   */
  providersLoading: boolean;

  /**
   * Bootstrap error message when provider list IPC fails; null otherwise.
   */
  providersError: string | null;

  /**
   * Retries loading providers after a bootstrap failure.
   */
  onProvidersRetry: () => void;

  /**
   * Persists the collection settings form (triggered by Enter in the name field).
   */
  onSave: () => void;

  /**
   * Closes the settings view without saving (triggered by Escape in the name field).
   */
  onClose: () => void;

  /**
   * When false, hides the provider move selector for git-backed collections.
   */
  showProviderSelect?: boolean;
}

/**
 * Collection name and provider selector for the General tab.
 */
export function GeneralSection({
  name,
  onNameChange,
  connectionId,
  providers,
  onConnectionIdChange,
  providersLoading,
  providersError,
  onProvidersRetry,
  onSave,
  onClose,
  showProviderSelect = true
}: Props): JSX.Element {
  const providerId = useId();
  const providerSelectDisabled = providersLoading || providersError != null;

  return (
    <div className="mb-6 flex flex-col gap-4">
      <div>
        <FormGroup
          label="Name"
          htmlFor={COLLECTION_SETTINGS_NAME_INPUT_ID}
          labelTone="muted"
          description="Name shown in the sidebar and when this collection is selected."
        >
          <Input
            id={COLLECTION_SETTINGS_NAME_INPUT_ID}
            className="w-full"
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSave();
              if (e.key === 'Escape') onClose();
            }}
          />
        </FormGroup>
      </div>

      {showProviderSelect ? (
        <div>
          <FormGroup
            label="Provider"
            htmlFor={providerId}
            labelTone="muted"
            description="Changing the provider moves this collection and all of its requests."
          >
            <Select
              id={providerId}
              className="w-full"
              value={connectionId}
              disabled={providerSelectDisabled}
              onChange={(e) => onConnectionIdChange(e.target.value)}
            >
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name || 'Untitled'} ({providerOptionLabel(provider)})
                </option>
              ))}
            </Select>
            {providersLoading && <LoadingMessage className="mb-0 mt-1">Loading…</LoadingMessage>}
            {providersError && <ErrorRetry error={providersError} onRetry={onProvidersRetry} />}
          </FormGroup>
        </div>
      ) : null}
    </div>
  );
}
