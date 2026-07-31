import { describe, expect, it } from 'vitest';
import { defaultAuth } from '@harborclient/core/auth';
import type { ExportedFolder, Folder, SavedRequest } from '@harborclient/core/types';
import {
  buildFolderImportMaps,
  buildRequestFingerprintIndexes,
  buildRequestUuidIndex,
  createEmptyFolderImportMaps,
  folderSiblingNameKey,
  planImportedFolderUpsert,
  registerImportedFolderInMaps,
  resolveImportRequestId,
  resolveUpsertRequestFolderId
} from './collectionImport';

/**
 * Builds a minimal persisted folder row for import-map tests.
 *
 * @param overrides - Fields to set on the folder.
 * @returns Folder entity suitable for {@link buildFolderImportMaps}.
 */
function folderFixture(overrides: Partial<Folder> & Pick<Folder, 'id' | 'name'>): Folder {
  return {
    collection_id: 1,
    parent_folder_id: null,
    uuid: `uuid-${overrides.id}`,
    sort_order: overrides.id,
    variables: [],
    headers: [],
    userAgent: '',
    auth: defaultAuth(),
    pre_request_script: '',
    post_request_script: '',
    pre_request_scripts: [],
    post_request_scripts: [],
    created_at: '2026-01-01T00:00:00.000Z',
    marker: null,
    ...overrides
  };
}

/**
 * Builds a minimal exported folder row for upsert planning tests.
 *
 * @param overrides - Fields to set on the export row.
 * @returns Exported folder row.
 */
function exportedFolderFixture(
  overrides: Partial<ExportedFolder> & Pick<ExportedFolder, 'name'>
): ExportedFolder {
  return {
    uuid: overrides.uuid,
    name: overrides.name,
    parent_folder_uuid: overrides.parent_folder_uuid ?? null,
    sort_order: overrides.sort_order ?? 0,
    variables: [],
    headers: [],
    marker: null,
    ...overrides
  };
}

describe('folderSiblingNameKey', () => {
  it('scopes names by parent folder id', () => {
    expect(folderSiblingNameKey(null, 'Auth')).not.toBe(folderSiblingNameKey(2, 'Auth'));
    expect(folderSiblingNameKey(2, 'Auth')).toBe(folderSiblingNameKey(2, 'Auth'));
  });
});

describe('planImportedFolderUpsert', () => {
  it('matches by uuid when present', () => {
    const maps = buildFolderImportMaps([
      folderFixture({ id: 10, name: 'Auth', uuid: 'stable-auth' })
    ]);
    const plan = planImportedFolderUpsert(
      exportedFolderFixture({ name: 'Renamed', uuid: 'stable-auth' }),
      maps,
      null
    );
    expect(plan).toMatchObject({ action: 'update', existingId: 10, name: 'Renamed' });
  });

  it('falls back to sibling name when import regenerates folder uuids', () => {
    const parent = folderFixture({ id: 1, name: 'Users', uuid: 'local-users' });
    const nested = folderFixture({
      id: 2,
      name: 'Auth',
      uuid: 'local-auth',
      parent_folder_id: 1
    });
    const rootAuth = folderFixture({ id: 3, name: 'Auth', uuid: 'local-root-auth' });
    const maps = buildFolderImportMaps([parent, nested, rootAuth]);

    // Simulate a Postman refresh: new uuids, same sibling names under resolved parents.
    registerImportedFolderInMaps(maps, parent.id, parent.name, 'import-users', null);

    const nestedPlan = planImportedFolderUpsert(
      exportedFolderFixture({
        name: 'Auth',
        uuid: 'import-nested-auth',
        parent_folder_uuid: 'import-users'
      }),
      maps,
      parent.id
    );
    expect(nestedPlan).toMatchObject({
      action: 'update',
      existingId: nested.id,
      uuid: 'import-nested-auth'
    });

    const rootPlan = planImportedFolderUpsert(
      exportedFolderFixture({ name: 'Auth', uuid: 'import-root-auth' }),
      maps,
      null
    );
    expect(rootPlan).toMatchObject({
      action: 'update',
      existingId: rootAuth.id,
      uuid: 'import-root-auth'
    });
  });

  it('inserts when sibling name is new even if the global name exists', () => {
    const maps = buildFolderImportMaps([folderFixture({ id: 1, name: 'Auth', uuid: 'root-auth' })]);
    const plan = planImportedFolderUpsert(
      exportedFolderFixture({
        name: 'Auth',
        uuid: 'new-nested-auth',
        parent_folder_uuid: 'missing-parent'
      }),
      maps,
      99
    );
    expect(plan).toMatchObject({ action: 'insert', uuid: 'new-nested-auth' });
  });

  it('uses legacy global name match only when the export omits uuid', () => {
    const maps = createEmptyFolderImportMaps();
    registerImportedFolderInMaps(maps, 5, 'Legacy', 'local-legacy', null);
    const plan = planImportedFolderUpsert(exportedFolderFixture({ name: 'Legacy' }), maps, null);
    expect(plan).toMatchObject({ action: 'update', existingId: 5, uuid: 'local-legacy' });
  });
});

/**
 * Builds a minimal saved request for fingerprint upsert tests.
 *
 * @param overrides - Fields to set on the request.
 * @returns Saved request entity.
 */
function requestFixture(
  overrides: Partial<SavedRequest> & Pick<SavedRequest, 'id' | 'name' | 'method' | 'url'>
): SavedRequest {
  return {
    collection_id: 1,
    folder_id: null,
    uuid: `req-${overrides.id}`,
    headers: [],
    userAgent: '',
    params: [],
    auth: defaultAuth(),
    body: '',
    body_type: 'none',
    body_raw: null,
    body_raw_open: false,
    pre_request_script: '',
    post_request_script: '',
    pre_request_scripts: [],
    post_request_scripts: [],
    comment: '',
    tags: '',
    sort_order: overrides.id,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    marker: null,
    ...overrides
  };
}

describe('resolveImportRequestId', () => {
  it('matches by uuid first', () => {
    const existing = [
      requestFixture({
        id: 10,
        name: 'List',
        method: 'GET',
        url: '/items',
        folder_id: 2,
        uuid: 'stable-req'
      })
    ];
    const id = resolveImportRequestId(
      'stable-req',
      null,
      'GET',
      'Other',
      '/other',
      buildRequestUuidIndex(existing),
      buildRequestFingerprintIndexes(existing)
    );
    expect(id).toBe(10);
  });

  it('falls back to folder-scoped fingerprint when uuids regenerate', () => {
    const existing = [
      requestFixture({ id: 11, name: 'List', method: 'GET', url: '/items', folder_id: 2 })
    ];
    const id = resolveImportRequestId(
      'brand-new-uuid',
      2,
      'GET',
      'List',
      '/items',
      buildRequestUuidIndex(existing),
      buildRequestFingerprintIndexes(existing)
    );
    expect(id).toBe(11);
  });

  it('falls back to identity fingerprint when folder resolution returns null', () => {
    const existing = [
      requestFixture({ id: 12, name: 'List', method: 'GET', url: '/items', folder_id: 5 })
    ];
    const id = resolveImportRequestId(
      'brand-new-uuid',
      null,
      'GET',
      'List',
      '/items',
      buildRequestUuidIndex(existing),
      buildRequestFingerprintIndexes(existing)
    );
    expect(id).toBe(12);
  });
});

describe('resolveUpsertRequestFolderId', () => {
  it('prefers the imported folder when present', () => {
    expect(resolveUpsertRequestFolderId(7, 3)).toBe(7);
  });

  it('preserves the existing folder when import placement is lost', () => {
    expect(resolveUpsertRequestFolderId(null, 3)).toBe(3);
    expect(resolveUpsertRequestFolderId(null, null)).toBeNull();
    expect(resolveUpsertRequestFolderId(null, undefined)).toBeNull();
  });
});
