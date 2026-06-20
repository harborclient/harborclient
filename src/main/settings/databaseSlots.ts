import Store from 'electron-store';
import type { DatabaseConnection } from '#/shared/types';
import { getActiveDatabaseId, listDatabaseConnections } from '#/main/settings/databaseSettings';

type SlotsStore = {
  databaseSlots?: Record<string, number>;
};

let store: Store<SlotsStore> | null = null;

/**
 * Returns the lazy electron-store instance for database slot mappings.
 */
function getStore(): Store<SlotsStore> {
  if (!store) {
    store = new Store<SlotsStore>({
      name: 'settings'
    });
  }
  return store;
}

/**
 * Returns the next unused slot number for a new connection.
 *
 * @param slots - Current connection id to slot map.
 */
function nextSlot(slots: Record<string, number>): number {
  const values = Object.values(slots);
  if (values.length === 0) return 0;
  return Math.max(...values) + 1;
}

/**
 * Ensures every connection has a stable slot assignment.
 *
 * On first run, slot 0 is assigned to the active connection so existing IDs are preserved.
 *
 * @param connections - All configured database connections.
 * @param activeId - Primary connection id (slot 0 on first migration).
 * @returns Connection id to slot map.
 */
export function ensureDatabaseSlots(
  connections: DatabaseConnection[],
  activeId: string
): Record<string, number> {
  const settingsStore = getStore();
  const existing = settingsStore.get('databaseSlots') ?? {};
  const slots: Record<string, number> = { ...existing };

  if (Object.keys(slots).length === 0 && connections.length > 0) {
    const activeConnection =
      connections.find((conn) => conn.id === activeId) ??
      connections.find((conn) => conn.type === 'sqlite') ??
      connections[0];
    slots[activeConnection.id] = 0;

    let slot = 1;
    for (const conn of connections) {
      if (conn.id === activeConnection.id) continue;
      slots[conn.id] = slot;
      slot += 1;
    }

    settingsStore.set('databaseSlots', slots);
    return slots;
  }

  let changed = false;
  for (const conn of connections) {
    if (slots[conn.id] === undefined) {
      slots[conn.id] = nextSlot(slots);
      changed = true;
    }
  }

  if (changed) {
    settingsStore.set('databaseSlots', slots);
  }

  return slots;
}

/**
 * Returns the slot for a connection id, ensuring slots are migrated first.
 *
 * @param connectionId - Connection id to look up.
 */
export function getSlotForConnection(connectionId: string): number | undefined {
  const connections = listDatabaseConnections();
  const activeId = getActiveDatabaseId();
  const slots = ensureDatabaseSlots(connections, activeId);
  return slots[connectionId];
}

/**
 * Assigns a slot to a newly created connection.
 *
 * @param connectionId - New connection id.
 */
export function assignSlotForNewConnection(connectionId: string): void {
  const connections = listDatabaseConnections();
  const activeId = getActiveDatabaseId();
  const slots = ensureDatabaseSlots(connections, activeId);

  if (slots[connectionId] !== undefined) return;

  slots[connectionId] = nextSlot(slots);
  getStore().set('databaseSlots', slots);
}
