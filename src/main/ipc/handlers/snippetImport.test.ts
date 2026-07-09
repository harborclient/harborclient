import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalDatabase } from '#/main/storage/LocalDatabase';
import { importSnippetData } from '#/main/ipc/handlers/snippetImport';

const confirmDuplicateImport = vi.fn();

vi.mock('#/main/ipc/handlers/importDialogs', () => ({
  confirmDuplicateImport: (...args: unknown[]) => confirmDuplicateImport(...args)
}));

const getLocalDatabase = vi.fn();

vi.mock('#/main/storage/localDatabaseInstance', () => ({
  getLocalDatabase: () => getLocalDatabase()
}));

const snippetExport = {
  harborclientVersion: 1 as const,
  harborclientExport: 'snippet' as const,
  uuid: '11111111-1111-4111-8111-111111111111',
  name: 'Auth helper',
  code: "hc.variables.set('token', 'abc');",
  scope: 'pre-request' as const
};

describe('importSnippetData', () => {
  let database: LocalDatabase;
  let rootDir = '';

  beforeEach(async () => {
    rootDir = mkdtempSync(join(tmpdir(), 'harborclient-snippet-import-'));
    database = new LocalDatabase(rootDir);
    await database.init();
    getLocalDatabase.mockReturnValue(database);
    confirmDuplicateImport.mockReset();
  });

  afterEach(async () => {
    await database.close();
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('creates a snippet when the uuid is new', async () => {
    const result = await importSnippetData({} as never, null, snippetExport);

    expect(result?.action).toBe('created');
    expect(result?.snippet.uuid).toBe(snippetExport.uuid);
    expect(result?.snippet.name).toBe('Auth helper');
    expect(database.listSnippets()).toHaveLength(1);
  });

  it('updates an existing snippet when the user chooses update', async () => {
    database.createSnippet('Existing', 'old();', 'any', 'main', snippetExport.uuid);
    confirmDuplicateImport.mockResolvedValue('update');

    const result = await importSnippetData({} as never, null, {
      ...snippetExport,
      name: 'Updated helper',
      code: 'new();'
    });

    expect(result?.action).toBe('updated');
    expect(result?.snippet.name).toBe('Updated helper');
    expect(result?.snippet.code).toBe('new();');
    expect(database.listSnippets()).toHaveLength(1);
  });

  it('creates a copy with a fresh uuid when the user chooses copy', async () => {
    database.createSnippet('Existing', 'old();', 'any', 'main', snippetExport.uuid);
    confirmDuplicateImport.mockResolvedValue('copy');

    const result = await importSnippetData({} as never, null, {
      ...snippetExport,
      name: 'Copied helper'
    });

    expect(result?.action).toBe('created');
    expect(result?.snippet.uuid).not.toBe(snippetExport.uuid);
    expect(result?.snippet.name).toBe('Copied helper');
    expect(database.listSnippets()).toHaveLength(2);
  });

  it('returns null when the user cancels a duplicate import', async () => {
    database.createSnippet('Existing', 'old();', 'any', 'main', snippetExport.uuid);
    confirmDuplicateImport.mockResolvedValue('cancel');

    const result = await importSnippetData({} as never, null, snippetExport);

    expect(result).toBeNull();
    expect(database.listSnippets()).toHaveLength(1);
  });
});
