import { FormGroup, Input } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { SqliteSettings } from '#/shared/types';

interface Props {
  /**
   * Current SQLite settings values.
   */
  settings: SqliteSettings;

  /**
   * Whether inputs are disabled.
   */
  disabled?: boolean;

  /**
   * Called when a settings field changes.
   */
  onChange: (settings: SqliteSettings) => void;
}

/**
 * SQLite connection fields for database settings.
 */
export function SqliteFields({ settings, disabled = false, onChange }: Props): JSX.Element {
  /**
   * Updates a SQLite settings field.
   *
   * @param key - Field to update.
   * @param value - New field value.
   */
  const handleFieldChange = (key: keyof SqliteSettings, value: string): void => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="flex flex-col gap-4">
      <FormGroup label="Database filename" description="Stored in the application data directory.">
        <Input
          type="text"
          value={settings.dbFilename}
          disabled={disabled}
          onChange={(event) => handleFieldChange('dbFilename', event.target.value)}
        />
      </FormGroup>
    </div>
  );
}
