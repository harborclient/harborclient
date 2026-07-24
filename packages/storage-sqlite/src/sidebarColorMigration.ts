import type Database from 'better-sqlite3';

/**
 * Tables that store an optional sidebar color column.
 */
export type SidebarColorTable =
  | 'collections'
  | 'folders'
  | 'requests'
  | 'documents'
  | 'environments'
  | 'tab_groups';

/**
 * Adds a nullable `color` TEXT column to a SQLite table when missing.
 *
 * @param database - Open SQLite database handle.
 * @param table - Table receiving the sidebar color column.
 */
export function migrateSidebarColorColumn(
  database: Database.Database,
  table: SidebarColorTable
): void {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (columns.some((column) => column.name === 'color')) {
    return;
  }
  database.exec(`ALTER TABLE ${table} ADD COLUMN color TEXT`);
}

/**
 * Normalizes a sidebar color for database storage.
 *
 * @param color - Selected CSS color or null to clear.
 */
export function serializeSidebarColor(color: string | null | undefined): string | null {
  if (color == null) {
    return null;
  }
  const trimmed = color.trim();
  return trimmed.length > 0 ? trimmed : null;
}
