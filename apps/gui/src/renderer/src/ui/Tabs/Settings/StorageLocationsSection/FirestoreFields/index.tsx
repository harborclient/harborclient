import { FormGroup, Input } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { FirestoreSettings } from '#/shared/types';

interface Props {
  /**
   * Current Firestore settings values.
   */
  settings: FirestoreSettings;

  /**
   * Whether inputs are disabled.
   */
  disabled?: boolean;

  /**
   * Called when a settings field changes.
   */
  onChange: (settings: FirestoreSettings) => void;
}

/**
 * Firestore connection fields for database settings.
 */
export function FirestoreFields({ settings, disabled = false, onChange }: Props): JSX.Element {
  /**
   * Updates a Firestore settings field.
   *
   * @param key - Field to update.
   * @param value - New field value.
   */
  const handleFieldChange = (key: keyof FirestoreSettings, value: string): void => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="flex flex-col gap-4">
      <FormGroup label="API key">
        <Input
          type="text"
          value={settings.apiKey}
          disabled={disabled}
          onChange={(event) => handleFieldChange('apiKey', event.target.value)}
        />
      </FormGroup>

      <FormGroup label="Auth domain">
        <Input
          type="text"
          value={settings.authDomain}
          disabled={disabled}
          onChange={(event) => handleFieldChange('authDomain', event.target.value)}
        />
      </FormGroup>

      <FormGroup label="Project ID">
        <Input
          type="text"
          value={settings.projectId}
          disabled={disabled}
          onChange={(event) => handleFieldChange('projectId', event.target.value)}
        />
      </FormGroup>

      <FormGroup label="App ID">
        <Input
          type="text"
          value={settings.appId}
          disabled={disabled}
          onChange={(event) => handleFieldChange('appId', event.target.value)}
        />
      </FormGroup>

      <FormGroup label="Email">
        <Input
          type="email"
          value={settings.email}
          disabled={disabled}
          onChange={(event) => handleFieldChange('email', event.target.value)}
        />
      </FormGroup>

      <FormGroup label="Password">
        <Input
          type="password"
          value={settings.password}
          disabled={disabled}
          onChange={(event) => handleFieldChange('password', event.target.value)}
        />
      </FormGroup>
    </div>
  );
}
