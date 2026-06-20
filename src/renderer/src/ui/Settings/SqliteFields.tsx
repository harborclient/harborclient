import type { JSX } from 'react';
import type { SqliteSettings } from '#/shared/types';
import { field } from '#/renderer/src/ui/shared/classes';

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
      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-medium text-text">Database filename</span>
        <input
          type="text"
          className={field}
          value={settings.dbFilename}
          disabled={disabled}
          onChange={(event) => handleFieldChange('dbFilename', event.target.value)}
        />
        <p className="m-0 text-[12px] text-muted">Stored in the application data directory.</p>
      </label>
    </div>
  );
}
