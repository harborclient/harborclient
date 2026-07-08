import type { BrowserWindow } from 'electron';
import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { validateSnippetExport } from '#/main/storage/snippetData';
import type { IStorage } from '#/main/storage/IStorage';
import { RoutingStorage } from '#/main/storage/RoutingStorage';
import { mintFreshSnippetExportUuid, resolveImportUuid } from '#/main/storage/uuid';
import { confirmDuplicateImport } from '#/main/ipc/handlers/importDialogs';
import type { ImportAction, Snippet } from '#/shared/types';

/**
 * Result of importing a snippet from a portable export file.
 */
export interface SnippetImportResult {
  /**
   * Imported or updated snippet.
   */
  snippet: Snippet;

  /**
   * Whether a new snippet was created or an existing one was updated.
   */
  action: ImportAction;
}

/**
 * Looks up an existing snippet by portable uuid.
 *
 * @param db - Database instance backing snippet persistence.
 * @param uuid - Stable snippet identifier from an export file.
 * @returns Matching snippet, or undefined when not found.
 */
async function findExistingSnippet(db: IStorage, uuid: string): Promise<Snippet | undefined> {
  if (db instanceof RoutingStorage) {
    const snippets = await db.listSnippets();
    return snippets.find((snippet) => snippet.uuid === uuid);
  }

  return getLocalDatabase()
    .listSnippets()
    .find((snippet) => snippet.uuid === uuid);
}

/**
 * Persists an imported snippet export, deduplicating by uuid when present.
 *
 * @param db - Database instance backing snippet persistence.
 * @param win - Focused browser window for duplicate-import prompts, if any.
 * @param parsed - Parsed JSON from a snippet export file.
 * @returns The created or updated snippet with action, or null when canceled.
 */
export async function importSnippetData(
  db: IStorage,
  win: BrowserWindow | null,
  parsed: unknown
): Promise<SnippetImportResult | null> {
  const data = validateSnippetExport(parsed);
  let payload = data;

  const existing = await findExistingSnippet(db, data.uuid);
  if (existing) {
    const choice = await confirmDuplicateImport(win, 'snippet', existing.name);
    if (choice === 'cancel') {
      return null;
    }
    if (choice === 'update') {
      const snippet =
        db instanceof RoutingStorage
          ? await db.updateSnippet(existing.id, data.name, data.code, data.scope)
          : getLocalDatabase().updateSnippet(existing.id, data.name, data.code, data.scope);
      return { snippet, action: 'updated' };
    }
    payload = mintFreshSnippetExportUuid(data);
  }

  const targetUuid = resolveImportUuid(payload.uuid);
  const snippet =
    db instanceof RoutingStorage
      ? await db.createSnippet(payload.name, payload.code, payload.scope, targetUuid)
      : getLocalDatabase().createSnippet(payload.name, payload.code, payload.scope, targetUuid);
  return { snippet, action: 'created' };
}
