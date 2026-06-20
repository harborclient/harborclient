import type { JSX } from 'react';
import type { DatabaseConnection } from '#/shared/types';
import { field } from '#/renderer/src/ui/shared/classes';
import { providerLabel } from '#/renderer/src/ui/Sidebar/Settings/constants';

interface Props {
  name: string;
  onNameChange: (name: string) => void;
  connectionId: string;
  connections: DatabaseConnection[];
  onConnectionIdChange: (connectionId: string) => void;
  onSave: () => void;
  onClose: () => void;
}

/**
 * Collection name and database selector for the General tab.
 */
export function GeneralSection({
  name,
  onNameChange,
  connectionId,
  connections,
  onConnectionIdChange,
  onSave,
  onClose
}: Props): JSX.Element {
  return (
    <div className="mb-6 flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-[13px] text-muted">Name</label>
        <input
          className={`${field} w-full`}
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave();
            if (e.key === 'Escape') onClose();
          }}
        />
      </div>

      <div>
        <label className="mb-1 block text-[13px] text-muted">Database</label>
        <select
          className={`${field} w-full`}
          value={connectionId}
          onChange={(e) => onConnectionIdChange(e.target.value)}
        >
          {connections.map((connection) => (
            <option key={connection.id} value={connection.id}>
              {connection.name || 'Untitled'} ({providerLabel(connection.type)})
            </option>
          ))}
        </select>
        <p className="mb-0 mt-1 text-[12px] text-muted">
          Changing the database moves this collection and all of its requests.
        </p>
      </div>
    </div>
  );
}
