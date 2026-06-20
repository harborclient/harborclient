import type { JSX } from 'react';
import type { DatabaseConnection, DatabaseProvider } from '#/shared/types';
import { SegmentedTabs } from '#/renderer/src/components/SegmentedTabs';
import { field } from '#/renderer/src/ui/shared/classes';
import { createBlankConnection, PROVIDER_OPTIONS, providerLabel } from './constants';
import { FirestoreFields } from './FirestoreFields';
import { MySqlFields } from './MySqlFields';
import { PostgresFields } from './PostgresFields';
import { SqliteFields } from './SqliteFields';

interface Props {
  /**
   * Connection being edited.
   */
  connection: DatabaseConnection;

  /**
   * Whether this is a new connection (allows changing type).
   */
  isNew: boolean;

  /**
   * Whether inputs are disabled.
   */
  disabled?: boolean;

  /**
   * Called when the connection changes.
   */
  onChange: (connection: DatabaseConnection) => void;
}

/**
 * Form for editing a named database connection.
 */
export function DatabaseConnectionForm({
  connection,
  isNew,
  disabled = false,
  onChange
}: Props): JSX.Element {
  /**
   * Updates the connection name.
   *
   * @param name - New display name.
   */
  const handleNameChange = (name: string): void => {
    onChange({ ...connection, name });
  };

  /**
   * Switches the connection type and resets settings for new connections.
   *
   * @param type - Selected database provider type.
   */
  const handleTypeChange = (type: DatabaseProvider): void => {
    if (!isNew || type === connection.type) return;
    onChange(createBlankConnection(type));
  };

  /**
   * Updates type-specific settings.
   *
   * @param next - Updated connection with new settings.
   */
  const handleSettingsChange = (next: DatabaseConnection): void => {
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-[12px] font-medium text-text">Name</span>
        <input
          type="text"
          className={field}
          value={connection.name}
          disabled={disabled}
          placeholder="My database"
          onChange={(event) => handleNameChange(event.target.value)}
        />
      </label>

      {isNew ? (
        <div>
          <span className="mb-2 block text-[12px] font-medium text-text">Type</span>
          <SegmentedTabs
            value={connection.type}
            onChange={handleTypeChange}
            tabs={PROVIDER_OPTIONS}
          />
        </div>
      ) : (
        <div>
          <span className="mb-1 block text-[12px] font-medium text-text">Type</span>
          <p className="m-0 text-[13px] text-text">{providerLabel(connection.type)}</p>
        </div>
      )}

      {connection.type === 'sqlite' && (
        <SqliteFields
          settings={connection.settings}
          disabled={disabled}
          onChange={(settings) => handleSettingsChange({ ...connection, settings })}
        />
      )}

      {connection.type === 'firestore' && (
        <FirestoreFields
          settings={connection.settings}
          disabled={disabled}
          onChange={(settings) => handleSettingsChange({ ...connection, settings })}
        />
      )}

      {connection.type === 'mysql' && (
        <MySqlFields
          settings={connection.settings}
          disabled={disabled}
          onChange={(settings) => handleSettingsChange({ ...connection, settings })}
        />
      )}

      {connection.type === 'postgres' && (
        <PostgresFields
          settings={connection.settings}
          disabled={disabled}
          onChange={(settings) => handleSettingsChange({ ...connection, settings })}
        />
      )}
    </div>
  );
}
