import { ErrorRetry, FormGroup, Input, LoadingMessage, Select } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { useId } from 'react';
import type { ProviderOption } from '#/renderer/src/hooks/useProviders';
import { providerOptionLabel } from '#/renderer/src/hooks/useProviders';
import { COLLECTION_SETTINGS_NAME_INPUT_ID } from '#/renderer/src/ui/CollectionSettings/focusCollectionSettings';

interface Props {
  name: string;
  onNameChange: (name: string) => void;
  connectionId: string;
  providers: ProviderOption[];
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
  onSave: () => void;
  onClose: () => void;
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
  onClose
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
    </div>
  );
}
