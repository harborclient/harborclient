import type { JSX } from 'react';
import type { PostgresSettings } from '#/shared/types';
import { Input } from '#/renderer/src/components/forms';

interface Props {
  /**
   * Current PostgreSQL settings values.
   */
  settings: PostgresSettings;

  /**
   * Whether inputs are disabled.
   */
  disabled?: boolean;

  /**
   * Called when a settings field changes.
   */
  onChange: (settings: PostgresSettings) => void;
}

/**
 * PostgreSQL connection fields for database settings.
 */
export function PostgresFields({ settings, disabled = false, onChange }: Props): JSX.Element {
  /**
   * Updates a PostgreSQL settings field.
   *
   * @param key - Field to update.
   * @param value - New field value.
   */
  const handleFieldChange = (key: keyof PostgresSettings, value: string | number): void => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-[14px] font-medium text-text">Host</span>
        <Input
          type="text"
          value={settings.host}
          disabled={disabled}
          onChange={(event) => handleFieldChange('host', event.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[14px] font-medium text-text">Port</span>
        <Input
          type="number"
          value={settings.port}
          disabled={disabled}
          onChange={(event) => handleFieldChange('port', Number(event.target.value))}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[14px] font-medium text-text">User</span>
        <Input
          type="text"
          value={settings.user}
          disabled={disabled}
          onChange={(event) => handleFieldChange('user', event.target.value)}
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

      <label className="flex flex-col gap-1">
        <span className="text-[14px] font-medium text-text">Database</span>
        <Input
          type="text"
          value={settings.database}
          disabled={disabled}
          onChange={(event) => handleFieldChange('database', event.target.value)}
        />
      </label>
    </div>
  );
}
