import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { defaultAuth } from '@harborclient/core/auth';
import type { CollectionExport, Variable } from '@harborclient/core/types';
import {
  applyCollectionLocalVariables,
  collectionLocalVariablesPath,
  extractPrivateVariableValues,
  mergePrivateVariableValues,
  readCollectionLocalVariables,
  writeCollectionLocalVariables
} from './collectionLocalVariables';

/**
 * Builds a variable row for overlay tests.
 *
 * @param key - Variable key.
 * @param value - Variable value.
 * @param share - Whether the value is shared in committed exports.
 */
function variable(key: string, value: string, share: boolean): Variable {
  return { key, value, defaultValue: '', enabled: true, share };
}

describe('collectionLocalVariables', () => {
  it('extracts only non-shared variable values', () => {
    expect(
      extractPrivateVariableValues([
        variable('shared', 'visible', true),
        variable('secret', 'hidden', false),
        variable('  ', 'ignored', false)
      ])
    ).toEqual({ secret: 'hidden' });
  });

  it('merges private overlay values onto non-shared rows', () => {
    const merged = mergePrivateVariableValues(
      [variable('shared', 'visible', true), variable('secret', '', false)],
      { secret: 'restored' }
    );
    expect(merged).toEqual([
      variable('shared', 'visible', true),
      variable('secret', 'restored', false)
    ]);
  });

  it('round-trips private collection and folder values through the overlay file', () => {
    const dirPath = mkdtempSync(join(tmpdir(), 'hc-local-vars-'));
    const folderUuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

    writeCollectionLocalVariables(
      dirPath,
      [variable('apiKey', 'sk-live', false), variable('baseUrl', 'https://api.example', true)],
      [
        {
          uuid: folderUuid,
          name: 'Auth',
          sort_order: 0,
          variables: [variable('token', 'folder-secret', false)],
          headers: [],
          userAgent: '',
          auth: defaultAuth(),
          pre_request_script: '',
          post_request_script: '',
          pre_request_scripts: [],
          post_request_scripts: [],
          marker: null,
          parent_folder_uuid: null
        }
      ]
    );

    const overlayPath = collectionLocalVariablesPath(dirPath);
    const written = JSON.parse(readFileSync(overlayPath, 'utf-8')) as {
      harborclientExport: string;
      variables: Record<string, string>;
      folders: Record<string, Record<string, string>>;
    };
    expect(written.harborclientExport).toBe('collection-local-variables');
    expect(written.variables).toEqual({ apiKey: 'sk-live' });
    expect(written.folders[folderUuid]).toEqual({ token: 'folder-secret' });

    const loaded = readCollectionLocalVariables(dirPath);
    expect(loaded?.variables.apiKey).toBe('sk-live');

    const exportData = {
      harborclientVersion: 1,
      harborclientExport: 'collection',
      uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: 'API',
      variables: [variable('apiKey', '', false), variable('baseUrl', 'https://api.example', true)],
      headers: [],
      userAgent: '',
      auth: defaultAuth(),
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: [],
      post_request_scripts: [],
      marker: null,
      folders: [
        {
          uuid: folderUuid,
          name: 'Auth',
          sort_order: 0,
          variables: [variable('token', '', false)],
          headers: [],
          userAgent: '',
          auth: defaultAuth(),
          pre_request_script: '',
          post_request_script: '',
          pre_request_scripts: [],
          post_request_scripts: [],
          marker: null,
          parent_folder_uuid: null
        }
      ],
      requests: [],
      documents: []
    } as CollectionExport;

    const merged = applyCollectionLocalVariables(exportData, dirPath);
    expect(merged.variables.find((row) => row.key === 'apiKey')?.value).toBe('sk-live');
    const folderToken = merged.folders?.[0]?.variables?.find((row) => row.key === 'token')?.value;
    expect(folderToken).toBe('folder-secret');

    writeCollectionLocalVariables(dirPath, [variable('baseUrl', 'https://api.example', true)], []);
    expect(readCollectionLocalVariables(dirPath)).toBeNull();

    rmSync(dirPath, { recursive: true, force: true });
  });
});
