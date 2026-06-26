import type { JSX } from 'react';
import type { FirestoreSettings } from '#/shared/types';
import { Input } from '#/renderer/src/components/forms';

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
      <label className="flex flex-col gap-1">
        <span className="text-[14px] font-medium text-text">API key</span>
        <Input
          type="text"
          value={settings.apiKey}
          disabled={disabled}
          onChange={(event) => handleFieldChange('apiKey', event.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[14px] font-medium text-text">Auth domain</span>
        <Input
          type="text"
          value={settings.authDomain}
          disabled={disabled}
          onChange={(event) => handleFieldChange('authDomain', event.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[14px] font-medium text-text">Project ID</span>
        <Input
          type="text"
          value={settings.projectId}
          disabled={disabled}
          onChange={(event) => handleFieldChange('projectId', event.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[14px] font-medium text-text">App ID</span>
        <Input
          type="text"
          value={settings.appId}
          disabled={disabled}
          onChange={(event) => handleFieldChange('appId', event.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[14px] font-medium text-text">Email</span>
        <Input
          type="email"
          value={settings.email}
          disabled={disabled}
          onChange={(event) => handleFieldChange('email', event.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[14px] font-medium text-text">Password</span>
        <Input
          type="password"
          value={settings.password}
          disabled={disabled}
          onChange={(event) => handleFieldChange('password', event.target.value)}
        />
      </label>
    </div>
  );
}
