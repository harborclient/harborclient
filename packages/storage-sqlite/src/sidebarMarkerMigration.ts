import type Database from 'better-sqlite3';

/**
 * Tables that store an optional sidebar marker column.
 */
export type SidebarMarkerTable =
  | 'collections'
  | 'folders'
  | 'requests'
  | 'documents'
  | 'environments'
  | 'workspaces';

/**
 * Ensures a SQLite table carries a nullable `marker` TEXT column.
 *
 * Databases created before the marker rename hold the value in a `color`
 * column. Those are renamed in place rather than replaced, so assignments made
 * before the upgrade survive it.
 *
 * @param database - Open SQLite database handle.
 * @param table - Table receiving the sidebar marker column.
 */
export function migrateSidebarMarkerColumn(
  database: Database.Database,
  table: SidebarMarkerTable
): void {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (columns.some((column) => column.name === 'marker')) {
    return;
  }
  if (columns.some((column) => column.name === 'color')) {
    database.exec(`ALTER TABLE ${table} RENAME COLUMN color TO marker`);
    return;
  }
  database.exec(`ALTER TABLE ${table} ADD COLUMN marker TEXT`);
}

/**
 * Normalizes a sidebar marker for database storage.
 *
 * @param marker - Selected CSS color string, or null to clear the marker.
 */
export function serializeSidebarMarker(marker: string | null | undefined): string | null {
  if (marker == null) {
    return null;
  }
  const trimmed = marker.trim();
  return trimmed.length > 0 ? trimmed : null;
}
