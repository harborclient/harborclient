import type { JSX } from 'react';
import type { MySqlSettings } from '#/shared/types';
import { field } from '#/renderer/src/ui/shared/classes';

interface Props {
  /**
   * Current MySQL settings values.
   */
  settings: MySqlSettings;

  /**
   * Whether inputs are disabled.
   */
  disabled?: boolean;

  /**
   * Called when a settings field changes.
   */
  onChange: (settings: MySqlSettings) => void;
}

/**
 * MySQL connection fields for database settings.
 */
export function MySqlFields({ settings, disabled = false, onChange }: Props): JSX.Element {
  /**
   * Updates a MySQL settings field.
   *
   * @param key - Field to update.
   * @param value - New field value.
   */
  const handleFieldChange = (key: keyof MySqlSettings, value: string | number): void => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-medium text-text">Host</span>
        <input
          type="text"
          className={field}
          value={settings.host}
          disabled={disabled}
          onChange={(event) => handleFieldChange('host', event.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-medium text-text">Port</span>
        <input
          type="number"
          className={field}
          value={settings.port}
          disabled={disabled}
          onChange={(event) => handleFieldChange('port', Number(event.target.value))}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-medium text-text">User</span>
        <input
          type="text"
          className={field}
          value={settings.user}
          disabled={disabled}
          onChange={(event) => handleFieldChange('user', event.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-medium text-text">Password</span>
        <input
          type="password"
          className={field}
          value={settings.password}
          disabled={disabled}
          onChange={(event) => handleFieldChange('password', event.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-medium text-text">Database</span>
        <input
          type="text"
          className={field}
          value={settings.database}
          disabled={disabled}
          onChange={(event) => handleFieldChange('database', event.target.value)}
        />
      </label>
    </div>
  );
}
